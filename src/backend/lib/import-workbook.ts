import { and, asc, between, eq, inArray, type Column } from "drizzle-orm";
import type { Db } from "@/backend/db";
import {
  accounts, branchAreas, companyMonthly, detectedGroups, detectedUnits, facts, groupNames, groupAmounts, organizations, statementLines, totalOverrides, unitCategories, unitClosure, unitOverrides,
  units, uploadLogs, userUnitScopes, zones, type UnitCategory,
} from "@/backend/db/schema";
import { buildClosure } from "./authz/scope";
import {
  computeStatement, GROUP_SECTIONS, KNOWN_GROUPS, nodesForSheet, rollup, type ExtraGroup, type GroupAmounts, type GroupSection,
} from "./master-import/compute";
import {
  buildUnitTree, codeLeafDefaults, DEFAULT_CATEGORIES, DEFAULT_ORG, DEFAULT_ZONES, diffUnitTree, LEGACY_UNIT_MAP,
  resolveLeaves, resolveZoneCode, zoneOfSheet, type CategoryDef, type Leaf, type LeafSettings, type Organization, type UnitRow, type UnitTreeChange,
  type ZoneDef,
} from "./master-import/units";
import { backupPendingMasters, type BackupResult } from "./master-backup";
import { removeMasterFile, saveMasterFile } from "./master-storage";
import { recomputeSalesBenchmarks } from "./sales-benchmark";
import { ACCOUNTS, type TotalKey } from "./statement";

// ตัวอ่านไฟล์ (master-import/parse.ts) แปลงไฟล์เป็น ParsedMaster แล้วส่งให้ importMaster

export type ParsedMaster = {
  /** เดือนที่มีข้อมูล เรียงจากน้อยไปมาก · units = ยอดต่อ Group ของแต่ละหน่วย (ผ่าน normalizeGroups แล้ว) */
  months: { month: number; units: Map<string, GroupAmounts> }[];
  /** จำนวนยอดราย Group ที่อ่านได้ (แสดงในประวัติการนำเข้า) */
  rowCount: number;
  /** หน่วยในไฟล์ที่ไม่อยู่ในผังในโค้ด — บันทึกลง detected_units ให้ผู้ดูแลเลือกประเภท */
  newUnits?: { code: string; name: string; sheet: string; zoneCode: string | null }[];
  /** Group ใหม่ (ไม่อยู่ใน Flow และยังไม่เลือกหมวด) — บันทึกลง detected_groups ให้ผู้ดูแลเลือกหมวด */
  unknownGroups?: { group: string; name: string; amount: number }[];
  /** พื้นที่ ตร.ม. จากชีต Branch_Area · null/ไม่ส่ง = ไฟล์ไม่มีชีตนี้ (คงค่าเดิมในตาราง branch_areas) */
  areas?: BranchAreaRow[] | null;
  /** ยอดราย Group ทั้งบริษัทรายเดือนจากชีต Monthy · null/ไม่ส่ง = ไฟล์ไม่มีชีตนี้ (คงค่าเดิมในตาราง company_monthly) */
  monthy?: { months: { month: number; groups: GroupAmounts }[] } | null;
};

export type BranchAreaRow = { code: string; name: string; area: number };

export const periodOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

/** งวดทั้งปี (ค.ศ.) ของคอลัมน์ period — ไฟล์ Master 1 ไฟล์ = ข้อมูล 1 ปี */
export const inYear = (column: Column, year: number) => between(column, periodOf(year, 1), periodOf(year, 12));

/**
 * รหัสหน่วยที่มีข้อมูลในปีนี้ — ผังหน่วยของปีคัดลอกมาจากปีอื่นและมีสาขาจากโค้ดทุกปี จึงใช้ชุดนี้ซ่อนหน่วยที่ไม่มีข้อมูลตอนแสดง
 * statement_lines = หน่วยในผัง (รวมหน่วยแม่) · group_amounts = รหัสหน่วยล่างสุดตามไฟล์ (รวมหน่วยที่ยังไม่อยู่ในผัง)
 */
export async function unitCodesWithData(db: Pick<Db, "selectDistinct">, year: number): Promise<Set<string>> {
  const [lines, amounts] = await Promise.all([
    db.selectDistinct({ code: statementLines.unitCode }).from(statementLines).where(inYear(statementLines.period, year)),
    db.selectDistinct({ code: groupAmounts.unitCode }).from(groupAmounts).where(inYear(groupAmounts.period, year)),
  ]);
  return new Set([...lines, ...amounts].map((r) => r.code));
}

const CHUNK = 1000;

/** Db หรือ transaction (ใช้ได้ทั้งสองแบบ) */
type Tx = Pick<Db, "select" | "insert" | "delete" | "update">;

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

// ---------- ข้อมูลหลักแยกตามปี ----------

/** ปี (ค.ศ.) ที่มีข้อมูลหลัก เรียงเก่า → ใหม่ — ทุกปีที่สร้างแล้วมีแถวในตาราง zones เสมอ */
export async function masterYears(db: Tx): Promise<number[]> {
  const rows = await db.select({ year: zones.year }).from(zones).groupBy(zones.year).orderBy(asc(zones.year));
  return rows.map((r) => r.year);
}

/** ตารางข้อมูลหลักที่คัดลอกทั้งชุดเมื่อสร้างปีใหม่ (ผัง units/unit_closure สร้างใหม่ตอน syncUnitTree แต่คัดลอกไว้ให้ใช้ได้ทันที) */
const YEAR_TABLES = [zones, unitCategories, organizations, detectedUnits, unitOverrides, detectedGroups, groupNames, branchAreas, units, unitClosure];

/** สร้างข้อมูลหลักของปี to จากสำเนาของปี from */
async function copyMasterYear(db: Tx, from: number, to: number) {
  for (const table of YEAR_TABLES) {
    const rows = await db.select().from(table).where(eq(table.year, from));
    // ประเภทของแต่ละตารางต่างกัน แต่แถวที่อ่านมาใส่กลับตารางเดิมได้ตรงตัว (แค่เปลี่ยนปี)
    await insertChunks(rows.map((r) => ({ ...r, year: to })), (c) => db.insert(table).values(c as never));
  }
}

/** ปีต้นแบบของปีที่ยังไม่มีข้อมูลหลัก: ปีก่อนหน้าที่ใกล้ที่สุด (ไม่มี = ปีถัดไปที่ใกล้ที่สุด) */
const sourceOf = (have: number[], year: number) => [...have].reverse().find((y) => y < year) ?? have.find((y) => y > year);

/**
 * ปีที่ใช้อ่านข้อมูลหลักแทนปีนี้ โดยไม่สร้างปีใหม่ (หน้าตรวจไฟล์ก่อนนำเข้า): มีปีนี้แล้ว = ปีนี้ · ยังไม่มี = ปีต้นแบบที่จะถูกคัดลอกตอนนำเข้า
 * ยังไม่มีปีใดเลย = ปีนี้ (อ่านแล้วได้ค่าเริ่มต้นในโค้ด)
 */
export async function masterYearFor(db: Tx, year: number): Promise<number> {
  const have = await masterYears(db);
  return have.includes(year) ? year : (sourceOf(have, year) ?? year);
}

/**
 * ให้ปีนี้มีข้อมูลหลัก: ยังไม่มี → คัดลอกจากปีก่อนหน้าที่ใกล้ที่สุด (ไม่มีปีก่อนหน้า = ปีถัดไปที่ใกล้ที่สุด)
 * ยังไม่มีปีใดเลย = ใช้ค่าเริ่มต้นในโค้ด (ensureMasterDefaults ใส่โซน/ประเภทเริ่มต้นให้)
 */
export async function ensureYear(db: Tx, year: number) {
  const have = await masterYears(db);
  if (have.includes(year)) return;
  const source = sourceOf(have, year);
  if (source !== undefined) await copyMasterYear(db, source, year);
}

/** สร้าง unit_closure ของปีใหม่จากผังของปีนั้น — throw ถ้าผังวนกลับ */
export async function rebuildClosure(tx: Tx, year: number) {
  const all = await tx.select({ code: units.code, parentCode: units.parentCode }).from(units).where(eq(units.year, year));
  const closure = buildClosure(all);
  await tx.delete(unitClosure).where(eq(unitClosure.year, year));
  await insertChunks(closure.map((c) => ({ ...c, year })), (c) => tx.insert(unitClosure).values(c));
}

/** ปีที่ต้องคำนวณงบ: ปีที่มีข้อมูลหลัก (ยอดของปีที่ไม่มีข้อมูลหลักคำนวณไม่ได้ — นำเข้าไฟล์สร้างข้อมูลหลักให้เสมอ) */
const yearsToCompute = (db: Tx, years?: number[]) => (years ? Promise.resolve(years) : masterYears(db));

/**
 * คำนวณงบของทุกหน่วย (รวมหน่วยแม่) ทุกงวดของปีที่ระบุ (ไม่ระบุ = ทุกปี) จาก group_amounts + ข้อมูลหลักของปีนั้น
 * แล้วแทน statement_lines ของปีนั้น — Dashboard อ่านผลนี้ตรงๆ ไม่ต้องคำนวณเอง
 */
export async function recomputeStatements(tx: Tx, years?: number[]): Promise<number> {
  let total = 0;
  for (const year of await yearsToCompute(tx, years)) total += await recomputeYear(tx, year);
  return total;
}

async function recomputeYear(tx: Tx, year: number): Promise<number> {
  const [tree, amounts, overrides, extra, rename] = await Promise.all([
    tx.select({ code: units.code, parentCode: units.parentCode }).from(units).where(eq(units.year, year)),
    tx.select().from(groupAmounts).where(inYear(groupAmounts.period, year)),
    tx.select().from(totalOverrides).where(inYear(totalOverrides.period, year)),
    listExtraGroups(tx, year),
    listGroupRenames(tx, year),
  ]);
  // ยอดรวมตามไฟล์ที่เลือกใช้แทนยอดที่คำนวณ: period|unit → { REV: …, GP: … }
  const fileTotals = new Map<string, Partial<Record<TotalKey, number>>>();
  for (const o of overrides) {
    const key = `${o.period}|${o.unitCode}`;
    fileTotals.set(key, { ...fileTotals.get(key), [o.totalKey]: Number(o.amount) });
  }
  const byPeriod = new Map<string, Map<string, GroupAmounts>>();
  for (const a of amounts) {
    const unitsOf = byPeriod.get(a.period) ?? new Map<string, GroupAmounts>();
    const g = unitsOf.get(a.unitCode) ?? {};
    g[a.groupCode] = Number(a.amount);
    unitsOf.set(a.unitCode, g);
    byPeriod.set(a.period, unitsOf);
  }

  const rows: (typeof statementLines.$inferInsert)[] = [];
  for (const [period, leaves] of byPeriod) {
    for (const [unitCode, groups] of rollup(tree, leaves)) {
      for (const line of computeStatement(groups, fileTotals.get(`${period}|${unitCode}`), extra, rename)) rows.push({ ...line, period, unitCode });
    }
  }
  await tx.delete(statementLines).where(inYear(statementLines.period, year));
  await insertChunks(rows, (c) => tx.insert(statementLines).values(c));
  // เกณฑ์รายได้ต่อ ตร.ม. ของ Sales Zone ขึ้นกับยอด Group A และผังหน่วยเหมือนงบ — คำนวณใหม่พร้อมกัน
  await recomputeSalesBenchmarks(tx, year);
  return rows.length;
}

// ---------- Group ใหม่ (คอลัมน์ A ที่ไม่อยู่ใน Flow ในโค้ด) ----------

/** Group ใหม่ของปีนี้ที่ผู้ดูแลเลือกหมวดแล้ว — นับในงบท้ายหมวดนั้น (Group ที่ภายหลังถูกเพิ่มเข้า Flow ในโค้ดแล้วไม่นับซ้ำ) */
export async function listExtraGroups(db: Tx, year: number): Promise<ExtraGroup[]> {
  const rows = await db.select().from(detectedGroups).where(eq(detectedGroups.year, year)).orderBy(asc(detectedGroups.assignedAt), asc(detectedGroups.code));
  return rows.flatMap((r) => (r.section && !KNOWN_GROUPS.has(r.code) ? [{ code: r.code, name: r.name, section: r.section }] : []));
}

/** Group ใหม่ที่ตรวจพบในไฟล์ของปีนี้: ใส่รหัสที่ยังไม่เคยพบ · ที่ยังรอเลือกอัปเดตชื่อตามไฟล์ล่าสุด · ทุกตัวอัปเดตยอดตามไฟล์ล่าสุด */
export async function recordDetectedGroups(tx: Tx, year: number, found: NonNullable<ParsedMaster["unknownGroups"]>) {
  if (found.length === 0) return;
  const existing = new Map((await tx.select().from(detectedGroups).where(eq(detectedGroups.year, year))).map((d) => [d.code, d]));
  const fresh = found.filter((f) => !existing.has(f.group));
  if (fresh.length) {
    await tx.insert(detectedGroups).values(fresh.map((f) => ({ year, code: f.group, name: f.name.slice(0, 128), fileAmount: f.amount.toFixed(2) })));
  }
  for (const f of found) {
    const d = existing.get(f.group);
    if (!d) continue;
    await tx
      .update(detectedGroups)
      .set({ fileAmount: f.amount.toFixed(2), ...(d.section === null && { name: f.name.slice(0, 128) }) })
      .where(and(eq(detectedGroups.year, year), eq(detectedGroups.code, f.group)));
  }
}

const SECTION_CODES = new Set<string>(GROUP_SECTIONS.map((s) => s.section));

/**
 * ผู้ดูแลเลือกหมวดให้ Group ใหม่ (หลายตัวพร้อมกันได้) → คำนวณงบใหม่ครั้งเดียว
 * ยอดของ Group อยู่ใน group_amounts ตั้งแต่ตอนนำเข้าแล้ว จึงไม่ต้องนำเข้าไฟล์ซ้ำ
 */
export async function assignDetectedGroups(db: Db, year: number, codes: string[], section: GroupSection, name?: string) {
  if (!SECTION_CODES.has(section)) throw new Error(`ไม่พบหมวด ${section}`);
  await db.transaction(async (tx) => {
    const inThisYear = and(eq(detectedGroups.year, year), inArray(detectedGroups.code, codes));
    const found = new Set((await tx.select({ code: detectedGroups.code }).from(detectedGroups).where(inThisYear)).map((d) => d.code));
    const missing = codes.find((c) => !found.has(c));
    if (missing) throw new Error(`ไม่พบ Group ${missing}`);
    await tx
      .update(detectedGroups)
      .set({ section, assignedAt: new Date(), ...(name?.trim() && { name: name.trim().slice(0, 128) }) })
      .where(inThisYear);
    await syncAccounts(tx, year);
    await recomputeStatements(tx, [year]);
  });
}

/** ชื่อที่ผู้ดูแลแก้ทับชื่อบัญชีของ Group ใน Flow ของปีนี้: รหัส → ชื่อ */
export async function listGroupRenames(db: Tx, year: number): Promise<Record<string, string>> {
  return Object.fromEntries((await db.select().from(groupNames).where(eq(groupNames.year, year))).map((r) => [r.code, r.name]));
}

/**
 * แก้ Group ย้อนหลัง (หน้า Group ในแอปหลังบ้าน) แล้วคำนวณงบใหม่ทุกงวดจากยอดที่เก็บไว้
 * Group ใน Flow: แก้ได้เฉพาะชื่อ (ว่าง/ตรงกับชื่อในโค้ด = ใช้ชื่อในโค้ด) — หมวดตายตัวตามสูตรของไฟล์ Excel
 * Group ใหม่: แก้ชื่อและหมวด · section null = กลับไปรอเลือก (ยอดไม่นับในงบ)
 */
export async function updateGroup(db: Db, year: number, code: string, changes: { name?: string; section?: GroupSection | null }) {
  const name = changes.name?.trim().slice(0, 128);
  await db.transaction(async (tx) => {
    if (KNOWN_GROUPS.has(code)) {
      if (changes.section !== undefined) throw new Error(`Group ${code} อยู่ใน Flow ของไฟล์ — เปลี่ยนหมวดไม่ได้ แก้ได้เฉพาะชื่อ`);
      if (name === undefined) return;
      await tx.delete(groupNames).where(and(eq(groupNames.year, year), eq(groupNames.code, code)));
      const base = ACCOUNTS.find((a) => a.code === code)?.name;
      if (name && name !== base) await tx.insert(groupNames).values({ year, code, name });
    } else {
      const thisGroup = and(eq(detectedGroups.year, year), eq(detectedGroups.code, code));
      const [found] = await tx.select().from(detectedGroups).where(thisGroup);
      if (!found) throw new Error(`ไม่พบ Group ${code}`);
      if (changes.section != null && !SECTION_CODES.has(changes.section)) throw new Error(`ไม่พบหมวด ${changes.section}`);
      await tx
        .update(detectedGroups)
        .set({
          ...(name && { name }),
          ...(changes.section !== undefined && { section: changes.section, assignedAt: changes.section ? (found.assignedAt ?? new Date()) : null }),
        })
        .where(thisGroup);
    }
    await syncAccounts(tx, year);
    await recomputeStatements(tx, [year]);
  });
}

/** หน่วยงานทั้งหมดของปีนี้: หน่วยงานเริ่มต้น (ในโค้ด ชื่อแก้ทับได้ด้วยแถวรหัสเดียวกัน) + ที่ผู้ดูแลเพิ่ม */
export async function listOrganizations(db: Tx, year: number): Promise<Organization[]> {
  const rows = await db.select().from(organizations).where(eq(organizations.year, year)).orderBy(asc(organizations.createdAt));
  const renamedDefault = rows.find((r) => r.code === DEFAULT_ORG.code);
  return [
    { code: DEFAULT_ORG.code, name: renamedDefault?.name ?? DEFAULT_ORG.name },
    ...rows.filter((r) => r.code !== DEFAULT_ORG.code).map(({ code, name }) => ({ code, name })),
  ];
}

// ---------- โซน / ประเภท: ค่าเริ่มต้นในโค้ด ใส่ลงตารางครั้งแรก แล้วอ่านจากตารางเสมอ ----------

/**
 * ให้ปีนี้มีข้อมูลหลัก (ensureYear) แล้วใส่โซน/ประเภทเริ่มต้นที่ยังไม่มีในปีนั้น
 * (โซนที่ผู้ดูแลลบแล้วยังมีแถว removed จึงไม่ถูกใส่กลับ)
 */
async function ensureMasterDefaults(db: Tx, year: number) {
  await ensureYear(db, year);
  const [zoneRows, categoryRows] = await Promise.all([
    db.select({ code: zones.code, baseCode: zones.baseCode }).from(zones).where(eq(zones.year, year)),
    db.select({ code: unitCategories.code }).from(unitCategories).where(eq(unitCategories.year, year)),
  ]);
  // โซนเริ่มต้นที่ใส่ไว้ก่อนมีคอลัมน์ base_code → เติมรหัสตามโค้ดให้ (ไม่งั้นแก้รหัสโซนแล้วระบบจะใส่โซนเดิมกลับมาอีกแถว)
  const defaultCodes = new Set(DEFAULT_ZONES.map((z) => z.code));
  for (const z of zoneRows) {
    if (z.baseCode === null && defaultCodes.has(z.code)) {
      await db.update(zones).set({ baseCode: z.code }).where(and(eq(zones.year, year), eq(zones.code, z.code)));
    }
  }
  const haveZone = new Set(zoneRows.flatMap((z) => [z.code, z.baseCode ?? z.code]));
  const missingZones = DEFAULT_ZONES.map((z, i) => ({ ...z, year, sortOrder: i })).filter((z) => !haveZone.has(z.code));
  if (missingZones.length) await db.insert(zones).values(missingZones);
  const haveCategory = new Set(categoryRows.map((c) => c.code));
  const missingCategories = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, year, sortOrder: i })).filter((c) => !haveCategory.has(c.code));
  if (missingCategories.length) await db.insert(unitCategories).values(missingCategories);
}

/** โซนที่ใช้งานอยู่ของปีนี้ เรียงตามลำดับ */
export async function listZones(db: Tx, year: number): Promise<ZoneDef[]> {
  await ensureMasterDefaults(db, year);
  const rows = await db.select().from(zones).where(and(eq(zones.year, year), eq(zones.removed, false))).orderBy(asc(zones.sortOrder));
  return rows.map(({ code, key, name, label, sheetPrefix, baseCode }) => ({ code, key, name, label, sheetPrefix, baseCode }));
}

/** ประเภทหน่วยทั้งหมดของปีนี้ เรียงตามลำดับกลุ่มในผัง */
export async function listCategories(db: Tx, year: number): Promise<CategoryDef[]> {
  await ensureMasterDefaults(db, year);
  const rows = await db.select().from(unitCategories).where(eq(unitCategories.year, year)).orderBy(asc(unitCategories.sortOrder));
  return rows.map(({ code, prefix, name, page }) => ({ code, prefix, name, page }));
}

/** ข้อมูลหลักของปีนี้ที่ใช้สร้างผัง (อ่านพร้อมกัน) */
async function masterData(db: Tx, year: number) {
  // ensureMasterDefaults ก่อน: ปีใหม่ต้องถูกคัดลอกครบก่อนอ่านหน่วยใหม่/ค่าแก้ทับ
  await ensureMasterDefaults(db, year);
  const [detected, overrides, orgs, zoneList, categories] = await Promise.all([
    db.select().from(detectedUnits).where(eq(detectedUnits.year, year)),
    db.select().from(unitOverrides).where(eq(unitOverrides.year, year)),
    listOrganizations(db, year), listZones(db, year), listCategories(db, year),
  ]);
  return { detected, overrides, orgs, zones: zoneList, categories };
}

/** เพิ่มหน่วยงานใหม่ในปีนี้ · ไม่ระบุรหัส = ระบบตั้งให้ (O2, O3, …) — ยังไม่มีหน่วยจึงยังไม่ต้องแทนผัง */
export async function createOrganization(db: Tx, year: number, name: string, code?: string): Promise<Organization> {
  const trimmed = name.trim();
  const all = await listOrganizations(db, year);
  if (all.some((o) => o.name === trimmed)) throw new Error(`มีหน่วยงานชื่อ "${trimmed}" อยู่แล้ว`);
  if (code && all.some((o) => o.code.toLowerCase() === code.toLowerCase())) throw new Error(`มีหน่วยงานรหัส ${code} อยู่แล้ว`);
  const next = Math.max(1, ...all.map((o) => Number(o.code.match(/^O(\d+)$/)?.[1] ?? 0))) + 1;
  const org = { code: code || `O${next}`, name: trimmed };
  await db.insert(organizations).values({ ...org, year });
  return org;
}

/** ผังที่ใช้จริงของปีนี้ = ผังในโค้ด (ทับด้วยค่าที่ผู้ดูแลแก้) + หน่วยใหม่ที่ผู้ดูแลเลือกประเภทแล้ว แยกตามหน่วยงาน */
export async function currentUnitTree(db: Tx, year: number): Promise<UnitRow[]> {
  const m = await masterData(db, year);
  return buildUnitTree(m.detected, m.overrides, m.orgs, m.zones, m.categories);
}

/** หน่วยล่างสุดทั้งหมดในผังของปีนี้ พร้อมหน่วยงาน/โซน/ประเภทที่ใช้จริง */
export async function currentLeaves(db: Tx, year: number): Promise<Leaf[]> {
  const m = await masterData(db, year);
  return resolveLeaves(m.detected, m.overrides, m.orgs, m.zones, m.categories);
}

async function assertTargets(tx: Tx, year: number, changes: Partial<LeafSettings>) {
  if (changes.zoneCode !== undefined && !(await listZones(tx, year)).some((z) => z.code === changes.zoneCode)) {
    throw new Error(`ไม่พบโซน ${changes.zoneCode}`);
  }
  if (changes.orgCode !== undefined && !(await listOrganizations(tx, year)).some((o) => o.code === changes.orgCode)) {
    throw new Error(`ไม่พบหน่วยงาน ${changes.orgCode}`);
  }
  if (changes.category !== undefined && !(await listCategories(tx, year)).some((c) => c.code === changes.category)) {
    throw new Error(`ไม่พบประเภท ${changes.category}`);
  }
}

/**
 * แก้ชื่อ/หน่วยงาน/โซน/ประเภทของหน่วยล่างสุดหลายหน่วยพร้อมกัน ในผังของปีนี้ (หน้า หน่วยงาน Sales Zone / Operations)
 * ค่าที่ไม่ส่งมา = คงเดิม · ทำใน transaction เดียว แล้วแทนผังและคำนวณงบของปีนี้ใหม่ครั้งเดียว
 * หน่วยในโค้ด → เก็บเฉพาะค่าที่ต่างจากโค้ดใน unit_overrides (ตรงกับโค้ดทั้งหมด = ลบค่าแก้ทับ) · หน่วยใหม่จากไฟล์ → แก้ที่ detected_units
 */
export async function updateLeafUnits(db: Db, year: number, codes: string[], changes: Partial<LeafSettings>) {
  await db.transaction(async (tx) => {
    await assertTargets(tx, year, changes);
    const leaves = new Map((await currentLeaves(tx, year)).map((l) => [l.code, l]));
    const zoneList = await listZones(tx, year);
    for (const code of codes) {
      const current = leaves.get(code);
      if (!current) throw new Error(`ไม่พบหน่วย ${code} ในผัง`);
      const next: LeafSettings = {
        name: changes.name ?? current.name,
        orgCode: changes.orgCode ?? current.orgCode,
        zoneCode: changes.zoneCode ?? current.zoneCode,
        category: changes.category ?? current.category,
      };
      const raw = codeLeafDefaults(code);
      // โซนตามโค้ดเทียบด้วยรหัสปัจจุบัน (โซนที่เปลี่ยนรหัสแล้วไม่นับว่าแก้ทับ)
      const base = raw && { ...raw, zoneCode: resolveZoneCode(raw.zoneCode, zoneList) ?? raw.zoneCode };
      const detectedRow = and(eq(detectedUnits.year, year), eq(detectedUnits.code, code));
      if (base) {
        const diff = {
          name: next.name === base.name ? null : next.name,
          orgCode: next.orgCode === base.orgCode ? null : next.orgCode,
          zoneCode: next.zoneCode === base.zoneCode ? null : next.zoneCode,
          category: next.category === base.category ? null : next.category,
        };
        await tx.delete(unitOverrides).where(and(eq(unitOverrides.year, year), eq(unitOverrides.code, code)));
        if (diff.name || diff.orgCode || diff.zoneCode || diff.category) await tx.insert(unitOverrides).values({ year, code, ...diff });
        // หน่วยในโค้ดที่เคยถูกลบแล้วเลือกคืนผ่านหน้า หน่วยงานใหม่ — ตอนนี้กลับมาเป็นหน่วยในโค้ดแล้ว ไม่ต้องมีแถวใน detected_units
        await tx.delete(detectedUnits).where(detectedRow);
      } else {
        await tx.update(detectedUnits).set(next).where(detectedRow);
      }
    }
    await syncUnitTree(tx, year);
    await recomputeStatements(tx, [year]);
  });
}

/**
 * ลบหน่วยล่างสุดออกจากผังของปีนี้ (ปุ่ม ลบ ในโหมดแก้ไขของหน้า หน่วยงาน Sales Zone / Operations) แล้วแทนผังและคำนวณงบใหม่ครั้งเดียว
 * หน่วยในโค้ด → บันทึก removed ใน unit_overrides · หน่วยใหม่จากไฟล์ → ลบแถวใน detected_units
 * ยอดใน group_amounts ยังเก็บไว้ (ไม่นับในงบเพราะไม่อยู่ในผัง) · นำเข้าไฟล์ของปีนี้ครั้งถัดไปแล้วยังมียอด → ไปรอที่หน้า หน่วยงานใหม่
 */
export async function deleteLeafUnits(db: Db, year: number, codes: string[]) {
  await db.transaction(async (tx) => {
    const leaves = new Set((await currentLeaves(tx, year)).map((l) => l.code));
    for (const code of codes) {
      if (!leaves.has(code)) throw new Error(`ไม่พบหน่วย ${code} ในผัง`);
      // หน่วยในโค้ดที่เคยถูกลบแล้วเลือกคืนจากหน้า หน่วยงานใหม่ มีแถวใน detected_units ด้วย — ลบทั้งสองที่ ไม่ให้กลับเข้าผังอีกทาง
      await tx.delete(detectedUnits).where(and(eq(detectedUnits.year, year), eq(detectedUnits.code, code)));
      if (codeLeafDefaults(code)) {
        await tx.delete(unitOverrides).where(and(eq(unitOverrides.year, year), eq(unitOverrides.code, code)));
        await tx.insert(unitOverrides).values({ year, code, removed: true });
      }
    }
    await syncUnitTree(tx, year);
    await recomputeStatements(tx, [year]);
  });
}

/** ผังของปีนี้ในฐานข้อมูลจะเปลี่ยนอย่างไรเมื่อแทนด้วยผังที่ใช้จริง (ใช้แสดงในหน้าตรวจไฟล์ก่อนยืนยัน) */
export async function previewUnitTree(db: Tx, year: number): Promise<UnitTreeChange> {
  const tree = await currentUnitTree(db, year);
  return diffUnitTree(await db.select().from(units).where(eq(units.year, year)), tree);
}

/** หน่วยในโค้ดที่ผู้ดูแลลบออกจากผังของปีนี้แล้ว แต่ไฟล์นี้ยังมียอด — ส่งไปรอที่หน้า หน่วยงานใหม่ ให้เลือกคืนได้ */
export async function removedWithData(tx: Tx, year: number, parsed: ParsedMaster): Promise<NonNullable<ParsedMaster["newUnits"]>> {
  const zoneList = await listZones(tx, year);
  const overrideRows = await tx.select().from(unitOverrides).where(eq(unitOverrides.year, year));
  const removed = overrideRows.filter((o) => o.removed);
  const withData = new Set(parsed.months.flatMap((m) => [...m.units].filter(([, g]) => Object.keys(g).length).map(([code]) => code)));
  return removed.flatMap((o) => {
    const base = codeLeafDefaults(o.code);
    return base && withData.has(o.code)
      ? [{ code: o.code, name: base.name, sheet: "(ลบออกจากผังแล้ว)", zoneCode: resolveZoneCode(base.zoneCode, zoneList) }]
      : [];
  });
}

/** หน่วยใหม่ที่ตรวจพบในไฟล์ของปีนี้: ใส่รหัสที่ยังไม่เคยพบ · รหัสที่ยังรอเลือกประเภทอัปเดตชื่อ/ชีต/โซนตามไฟล์ล่าสุด · ที่เลือกแล้วไม่แตะ */
export async function recordDetectedUnits(tx: Tx, year: number, input: NonNullable<ParsedMaster["newUnits"]>) {
  if (input.length === 0) return;
  // ตัวอ่านไฟล์เดาโซนจากโซนเริ่มต้นในโค้ด — เดาใหม่จากโซนที่ใช้จริง (รวมโซนที่ผู้ดูแลเพิ่มและชื่อชีตที่แก้แล้ว)
  const zoneList = await listZones(tx, year);
  const found = input.map((f) => ({
    ...f,
    zoneCode: zoneOfSheet(f.sheet, zoneList) ?? resolveZoneCode(f.zoneCode, zoneList),
  }));
  const existing = new Map((await tx.select().from(detectedUnits).where(eq(detectedUnits.year, year))).map((d) => [d.code, d]));
  const fresh = found.filter((f) => !existing.has(f.code));
  if (fresh.length) await tx.insert(detectedUnits).values(fresh.map(({ code, name, sheet, zoneCode }) => ({ year, code, name, sheet, zoneCode })));
  for (const f of found) {
    const d = existing.get(f.code);
    if (d && d.category === null) {
      await tx
        .update(detectedUnits)
        .set({ name: f.name, sheet: f.sheet, zoneCode: f.zoneCode ?? d.zoneCode })
        .where(and(eq(detectedUnits.year, year), eq(detectedUnits.code, f.code)));
    }
  }
}

/** ตั้งโซนให้หน่วยใหม่ของปีนี้ที่ยังรอเลือกประเภท (ยังไม่เข้าผัง จึงไม่ต้องคำนวณงบใหม่) */
export async function setDetectedZones(db: Db, year: number, codes: string[], zoneCode: string) {
  await db.transaction(async (tx) => {
    await assertTargets(tx, year, { zoneCode });
    const rows = and(eq(detectedUnits.year, year), inArray(detectedUnits.code, codes));
    const pending = new Map((await tx.select().from(detectedUnits).where(rows)).map((d) => [d.code, d]));
    for (const code of codes) {
      const d = pending.get(code);
      if (!d) throw new Error(`ไม่พบหน่วย ${code}`);
      if (d.category) throw new Error(`หน่วย ${code} เลือกประเภทแล้ว`);
    }
    await tx.update(detectedUnits).set({ zoneCode }).where(rows);
  });
}

/**
 * ผู้ดูแลเลือกประเภทให้หน่วยใหม่ของปีนี้ (หลายหน่วยพร้อมกันได้) → หน่วยเข้าผังใต้ Sz-/Op- ของโซน แล้วคำนวณงบของปีนี้ใหม่ครั้งเดียว
 * zoneCode/orgCode/name ไม่ส่งมา = ใช้ค่าของหน่วย (โซนที่เดาจากชีตหรือที่ตั้งไว้)
 */
export async function assignDetectedUnits(
  db: Db,
  year: number,
  codes: string[],
  input: { category: UnitCategory; zoneCode?: string; orgCode?: string; name?: string },
) {
  await db.transaction(async (tx) => {
    await assertTargets(tx, year, { zoneCode: input.zoneCode, orgCode: input.orgCode, category: input.category });
    const found = new Map(
      (await tx.select().from(detectedUnits).where(and(eq(detectedUnits.year, year), inArray(detectedUnits.code, codes)))).map((d) => [d.code, d]),
    );
    for (const code of codes) {
      const d = found.get(code);
      if (!d) throw new Error(`ไม่พบหน่วย ${code}`);
      const zoneCode = input.zoneCode ?? d.zoneCode;
      if (!zoneCode) throw new Error(`${code}: ระบบเดาโซนจากชีตไม่ได้ — ติ๊กเลือกแล้วกด "เลือกโซน" ก่อน`);
      await tx
        .update(detectedUnits)
        .set({ category: input.category, zoneCode, orgCode: input.orgCode ?? d.orgCode, name: input.name ?? d.name, assignedAt: new Date() })
        .where(and(eq(detectedUnits.year, year), eq(detectedUnits.code, code)));
    }
    await syncUnitTree(tx, year);
    await recomputeStatements(tx, [year]);
  });
}

/** รหัสหน่วยที่มีในผังของปีใดปีหนึ่ง (สิทธิ์ผู้ใช้ผูกกับรหัสหน่วยร่วมกันทุกปี) */
export async function unitCodesAnyYear(db: Tx): Promise<Set<string>> {
  return new Set((await db.select({ code: units.code }).from(units).groupBy(units.code)).map((u) => u.code));
}

/**
 * แทนผังหน่วยของปีนี้ในฐานข้อมูลด้วยผังที่ใช้จริง (ผังในโค้ด + หน่วยใหม่ที่เลือกประเภทแล้ว) แล้วสร้าง unit_closure ของปีนี้ใหม่
 * สิทธิ์ผู้ใช้ผูกกับรหัสหน่วยร่วมกันทุกปี: ย้ายตาม LEGACY_UNIT_MAP · ลบเฉพาะรหัสที่ไม่อยู่ในผังของปีใดเลย
 */
export async function syncUnitTree(tx: Tx, year: number): Promise<UnitTreeChange> {
  const tree = await currentUnitTree(tx, year);
  const change = diffUnitTree(await tx.select().from(units).where(eq(units.year, year)), tree);

  await tx.delete(units).where(eq(units.year, year));
  await tx.insert(units).values(tree.map((u) => ({ ...u, year })));
  await rebuildClosure(tx, year);

  const inTree = await unitCodesAnyYear(tx);
  const scopes = await tx.select().from(userUnitScopes);
  const kept = new Set(scopes.filter((s) => inTree.has(s.unitCode)).map((s) => `${s.userId}:${s.unitCode}`));
  const moved = new Map<string, { userId: number; unitCode: string }>();
  for (const s of scopes) {
    const target = LEGACY_UNIT_MAP[s.unitCode];
    if (inTree.has(s.unitCode) || !target || kept.has(`${s.userId}:${target}`)) continue;
    moved.set(`${s.userId}:${target}`, { userId: s.userId, unitCode: target });
  }
  const stale = [...new Set(scopes.filter((s) => !inTree.has(s.unitCode)).map((s) => s.unitCode))];
  if (stale.length) await tx.delete(userUnitScopes).where(inArray(userUnitScopes.unitCode, stale));
  if (moved.size) await tx.insert(userUnitScopes).values([...moved.values()]);
  return change;
}

export type ImportResult = { periods: string[]; lineCount: number; unitTree: UnitTreeChange; backups: BackupResult[] };

/** ยอดรวมของชีตตามไฟล์ (ชีตที่ยอดไม่ตรงกับที่ระบบคำนวณ) */
export type FileTotal = { month: number; leaves: string[]; key: TotalKey; amount: number };

/** หน่วยในผังที่ยอดรวมตามไฟล์ของแต่ละชีตจะไปใช้ (ไม่มีหน่วยที่ตรงกับชีต = unitCodes ว่าง → ใช้ยอดที่ระบบคำนวณ) */
export function fileTotalTargets(tree: { code: string; parentCode: string | null }[], parsed: ParsedMaster, totals: FileTotal[]) {
  return totals.map((t) => {
    const month = parsed.months.find((m) => m.month === t.month);
    const dataLeaves = new Set([...(month?.units ?? [])].filter(([, g]) => Object.keys(g).length).map(([code]) => code));
    return { ...t, unitCodes: nodesForSheet(tree, t.leaves, dataLeaves) };
  });
}

/**
 * นำเข้าไฟล์ Master: ไฟล์ที่ใช้งานได้ปีละ 1 ไฟล์ (หลายปีอยู่ร่วมกันได้)
 * ข้อมูลของปีนั้นทั้งปีถูกแทนด้วยไฟล์ใหม่ใน transaction เดียว (ยอดต่อ Group + ยอดรวมตามไฟล์) · ปีอื่นไม่เปลี่ยน
 * ข้อมูลหลัก (ผัง Group ตร.ม.) ใช้ของปีนั้น — ปีที่ยังไม่มีคัดลอกจากปีก่อนหน้า แล้วคำนวณงบของปีนั้นใหม่
 * ไฟล์ปีเดียวกันที่ใช้อยู่เดิมถูกย้ายขึ้น Google Drive
 * ถ้า backup ไม่สำเร็จ ข้อมูลใหม่ยังใช้งานได้ตามปกติ ไฟล์เก่ารอ backup อยู่ในเครื่อง
 */
export async function importMaster(
  db: Db,
  parsed: ParsedMaster,
  opts: {
    year: number; userId: number; fileName: string; data: Buffer;
    /** ผู้นำเข้าเลือก "ใช้ยอดรวมตามไฟล์" สำหรับชีตที่ยอดไม่ตรง · ไม่ส่ง = ใช้ยอดที่ระบบคำนวณ */
    fileTotals?: FileTotal[];
  },
): Promise<ImportResult> {
  const periods = parsed.months.map((m) => periodOf(opts.year, m.month));
  const storedPath = await saveMasterFile(opts.data);

  let replaced: number[] = [];
  let lineCount = 0;
  let unitTree: UnitTreeChange = { added: [], removed: [], updated: [] };
  try {
    const { year } = opts;
    replaced = await db.transaction(async (tx) => {
      // ปีใหม่ → ข้อมูลหลักเริ่มจากสำเนาของปีก่อนหน้า
      await ensureMasterDefaults(tx, year);
      // Group ใหม่ → รอผู้ดูแลเลือกหมวด (ยอดเก็บใน group_amounts แต่ยังไม่นับในงบ)
      await recordDetectedGroups(tx, year, parsed.unknownGroups ?? []);
      await syncAccounts(tx, year);
      // หน่วยนอกผังในโค้ด + หน่วยในโค้ดที่ผู้ดูแลลบออกแต่ไฟล์ยังมียอด → รอผู้ดูแลเลือกประเภท (ยอดเก็บใน group_amounts แต่ยังไม่นับในงบ)
      await recordDetectedUnits(tx, year, [...(parsed.newUnits ?? []), ...(await removedWithData(tx, year, parsed))]);
      // ผังหน่วยกำหนดในโค้ด (master-import/units.ts) + หน่วยใหม่ที่เลือกแล้ว — แทนผังของปีนี้ทุกครั้งที่นำเข้า
      unitTree = await syncUnitTree(tx, year);

      // แทนข้อมูลทั้งปีของไฟล์ (รวมเดือนที่ไฟล์เดิมมีแต่ไฟล์ใหม่ไม่มี — ข้อมูลต้องมาจากไฟล์ที่ใช้อยู่เท่านั้น) · ปีอื่นคงเดิม
      await tx.delete(groupAmounts).where(inYear(groupAmounts.period, opts.year));
      await tx.delete(facts).where(inYear(facts.period, opts.year));
      const amountRows = parsed.months.flatMap(({ month, units: byUnit }) =>
        [...byUnit].flatMap(([unitCode, groups]) =>
          Object.entries(groups)
            .filter(([, v]) => v !== 0)
            .map(([groupCode, v]) => ({ period: periodOf(opts.year, month), unitCode, groupCode, amount: v.toFixed(6) })),
        ),
      );
      await insertChunks(amountRows, (c) => tx.insert(groupAmounts).values(c));

      // พื้นที่ ตร.ม. (ชีต Branch_Area): มีชีต = แทนทั้งปี (รวมค่าที่ผู้ดูแลแก้ไว้) · ไม่มีชีต = คงค่าของปีนี้ (หรือสำเนาจากปีก่อน)
      if (parsed.areas) await replaceBranchAreas(tx, year, parsed.areas);
      // ภาพรวมบริษัท (ชีต Monthy): มีชีต = แทนทั้งปี · ไม่มีชีต = คงค่าของปีนี้
      if (parsed.monthy) await replaceCompanyMonthly(tx, year, parsed.monthy.months);

      // ยอดรวมตามไฟล์ (ถ้าเลือก) → ใช้กับหน่วยในผังที่ตรงกับชีตนั้น · ไม่เลือก = ล้างของไฟล์ก่อน ใช้ยอดที่ระบบคำนวณ
      await tx.delete(totalOverrides).where(inYear(totalOverrides.period, opts.year));
      if (opts.fileTotals?.length) {
        const tree = await tx.select({ code: units.code, parentCode: units.parentCode }).from(units).where(eq(units.year, year));
        const rows = fileTotalTargets(tree, parsed, opts.fileTotals).flatMap((t) =>
          t.unitCodes.map((unitCode) => ({ period: periodOf(opts.year, t.month), unitCode, totalKey: t.key, amount: t.amount.toFixed(2) })),
        );
        if (rows.length) await tx.insert(totalOverrides).values(rows);
      }
      lineCount = await recomputeStatements(tx, [year]);

      // ไฟล์ปีเดียวกันที่ใช้อยู่เดิม → รอ backup (ถ้ามีไฟล์ในเครื่อง) หรือ no_file (นำเข้าก่อนมีระบบเก็บไฟล์)
      const previous = await tx
        .select({ id: uploadLogs.id, storedPath: uploadLogs.storedPath })
        .from(uploadLogs)
        .where(and(eq(uploadLogs.status, "active"), inYear(uploadLogs.period, opts.year)));
      const withFile = previous.filter((p) => p.storedPath).map((p) => p.id);
      const withoutFile = previous.filter((p) => !p.storedPath).map((p) => p.id);
      const now = new Date();
      if (withFile.length) await tx.update(uploadLogs).set({ status: "backup_pending", replacedAt: now }).where(inArray(uploadLogs.id, withFile));
      if (withoutFile.length) await tx.update(uploadLogs).set({ status: "no_file", replacedAt: now }).where(inArray(uploadLogs.id, withoutFile));

      await tx.insert(uploadLogs).values({
        userId: opts.userId,
        period: periods[periods.length - 1],
        periods: periods.join(","),
        fileName: opts.fileName,
        sizeBytes: opts.data.length,
        // จำนวนยอดราย Group ที่อ่านจากไฟล์ (แสดงในประวัติการนำเข้า)
        factCount: parsed.rowCount,
        status: "active",
        storedPath,
      });
      return withFile;
    });
  } catch (e) {
    await removeMasterFile(storedPath);
    throw e;
  }

  const backups = replaced.length ? await backupPendingMasters(db, replaced) : [];
  return { periods, lineCount, unitTree, backups };
}

/**
 * ผังบัญชีในตาราง accounts = บัญชีในโค้ด (ชื่อที่ผู้ดูแลแก้ทับ) + Group ใหม่ที่เลือกหมวดแล้ว ของปีที่แก้ล่าสุด
 * (ตารางนี้ไม่แยกปีและไม่มีหน้าใดอ่าน — ชื่อ/หมวดในงบแต่ละปีมาจาก group_names / detected_groups ของปีนั้น)
 */
export async function syncAccounts(db: Tx, year: number) {
  const [extra, rename] = await Promise.all([listExtraGroups(db, year), listGroupRenames(db, year)]);
  const flow = ACCOUNTS.map((a) => ({ ...a, name: rename[a.code] ?? a.name }));
  for (const [i, a] of [...flow, ...extra].entries()) {
    await db.insert(accounts).values({ ...a, sortOrder: i }).onDuplicateKeyUpdate({
      set: { name: a.name, section: a.section, sortOrder: i },
    });
  }
}

/** แทน ตร.ม. ของปีนี้ด้วยค่าจากชีต Branch_Area (เกณฑ์คำนวณใหม่ใน recomputeStatements ที่ตามมา) */
/** แทนภาพรวมบริษัทรายเดือน (ชีต Monthy) ของทั้งปี — ใช้ตอนนำเข้าและสคริปต์ scripts/backfill-monthy.ts */
export async function replaceCompanyMonthly(tx: Tx, year: number, months: { month: number; groups: GroupAmounts }[]) {
  await tx.delete(companyMonthly).where(inYear(companyMonthly.period, year));
  await insertChunks(
    months.flatMap(({ month, groups }) =>
      Object.entries(groups)
        .filter(([, v]) => v !== 0)
        .map(([groupCode, v]) => ({ period: periodOf(year, month), groupCode, amount: v.toFixed(6) })),
    ),
    (c) => tx.insert(companyMonthly).values(c),
  );
}

export async function replaceBranchAreas(tx: Tx, year: number, rows: BranchAreaRow[]) {
  await tx.delete(branchAreas).where(eq(branchAreas.year, year));
  await insertChunks(
    rows.map((r) => ({ year, unitCode: r.code, name: r.name.slice(0, 128), areaSqm: r.area.toFixed(2), source: "file" as const })),
    (c) => tx.insert(branchAreas).values(c),
  );
}