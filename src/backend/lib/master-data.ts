import "server-only";
import { and, eq, isNull, max } from "drizzle-orm";
import type { Db } from "@/backend/db";
import { detectedUnits, organizations, totalOverrides, unitOverrides, userUnitScopes, zones } from "@/backend/db/schema";
import {
  currentLeaves, currentUnitTree, inYear, listCategories, listOrganizations, listZones, recomputeStatements, syncUnitTree, unitCodesWithData,
} from "./import-workbook";
import { DEFAULT_ORG, groupNodeCode, orgNodeCode, zoneNodeCode, type ZoneDef } from "./master-import/units";

// ข้อมูลหลักที่ผู้ดูแลแก้ในหน้า "แก้ไขฐานข้อมูล" ของแอปหลังบ้าน: โซน · หน่วยงาน — แยกตามปี (แก้ปีหนึ่งไม่กระทบปีอื่น)
// (ประเภทหน่วยไม่แก้จากแอปหลังบ้าน — ใช้ค่าในตาราง unit_categories ตามที่มีอยู่)
// ทุกการแก้ที่กระทบผังทำใน transaction เดียว แล้วแทนผังและคำนวณงบของปีนั้นใหม่ (เหมือนตอนแก้หน่วย)
// แก้รหัสได้: รหัสหน่วยในผังที่ประกอบจากรหัสนั้น (Zone-CMI, Sz-CMI, ORG-O2 …) เปลี่ยนตาม
// และค่าที่อ้างรหัสเดิม (สิทธิ์ผู้ใช้ · ยอดรวมตามไฟล์ · ค่าแก้ทับหน่วย · หน่วยใหม่ที่รอเลือก) ย้ายตามให้ในคราวเดียว

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function rebuild(tx: Tx, year: number) {
  await syncUnitTree(tx, year);
  await recomputeStatements(tx, [year]);
}

/** จำนวนหน่วยล่างสุดในผังของปีนี้แยกตามโซน / หน่วยงาน / ประเภท (แสดงในตาราง และใช้กันลบของที่ยังมีหน่วย) */
export async function leafCounts(db: Db, year: number) {
  const leaves = await currentLeaves(db, year);
  const count = (key: "zoneCode" | "orgCode" | "category") => {
    const m = new Map<string, number>();
    for (const l of leaves) m.set(l[key], (m.get(l[key]) ?? 0) + 1);
    return m;
  };
  return { zone: count("zoneCode"), org: count("orgCode"), category: count("category") };
}

/** เหมือน leafCounts แต่นับเฉพาะหน่วยที่มีข้อมูลในปีนี้ (ผังของปีมีหน่วยที่คัดลอกมาจากปีอื่น) */
export async function leafDataCounts(db: Db, year: number) {
  const [leaves, withData] = await Promise.all([currentLeaves(db, year), unitCodesWithData(db, year)]);
  const count = (key: "zoneCode" | "orgCode" | "category") => {
    const m = new Map<string, number>();
    for (const l of leaves) if (withData.has(l.code)) m.set(l[key], (m.get(l[key]) ?? 0) + 1);
    return m;
  };
  return { zone: count("zoneCode"), org: count("orgCode"), category: count("category") };
}

/** รหัสใหม่ในผังของปีนี้ห้ามชนกับรหัสหน่วยที่มีอยู่ (ยกเว้นรหัสเดิมที่กำลังถูกเปลี่ยน) */
async function assertCodesFree(tx: Tx, year: number, codes: string[], replacing: Iterable<string> = []) {
  const skip = new Set(replacing);
  const used = new Set((await currentUnitTree(tx, year)).map((u) => u.code).filter((c) => !skip.has(c)));
  const clash = codes.find((c) => used.has(c));
  if (clash) throw new Error(`รหัส ${clash} ซ้ำกับหน่วยที่มีอยู่ในผังแล้ว — ใช้รหัสอื่น`);
}

/**
 * เปลี่ยนรหัสหน่วยในผังของปีนี้ที่ถูกอ้างถึงนอกตาราง units (units / unit_closure / statement_lines สร้างใหม่ตอน rebuild อยู่แล้ว)
 * ยอดรวมตามไฟล์: เฉพาะงวดของปีนี้ · สิทธิ์ผู้ใช้ (ผูกกับรหัสร่วมกันทุกปี): เพิ่มสิทธิ์ที่รหัสใหม่ให้ผู้ใช้ที่มีสิทธิ์รหัสเดิม
 * — สิทธิ์ที่รหัสเดิมถูกลบตอน rebuild (syncUnitTree) เฉพาะเมื่อรหัสเดิมไม่อยู่ในผังของปีใดแล้ว
 */
async function moveUnitCodes(tx: Tx, year: number, map: Map<string, string>) {
  await assertCodesFree(tx, year, [...map.values()], map.keys());
  const scopes = await tx.select().from(userUnitScopes);
  const has = new Set(scopes.map((s) => `${s.userId}:${s.unitCode}`));
  for (const [from, to] of map) {
    if (from === to) continue;
    const add = scopes.filter((s) => s.unitCode === from && !has.has(`${s.userId}:${to}`)).map((s) => ({ userId: s.userId, unitCode: to }));
    if (add.length) await tx.insert(userUnitScopes).values(add);
    add.forEach((a) => has.add(`${a.userId}:${to}`));
    await tx.update(totalOverrides).set({ unitCode: to }).where(and(eq(totalOverrides.unitCode, from), inYear(totalOverrides.period, year)));
  }
}

const inUse = (n: number, what: string, fix: string) => new Error(`ยังมีหน่วย ${n} หน่วยใน${what}นี้ — ${fix}ก่อนลบ`);

// ---------- โซน ----------

/** รหัสโซน → รหัสย่อในรหัสกลุ่ม: Zone-CMI → CMI (รหัสที่ไม่ขึ้นต้น Zone- ใช้ทั้งรหัส) */
export const zoneKeyOf = (code: string) => code.replace(/^Zone-/i, "");

export type ZoneInput = { name: string; label: string; sheetPrefix: string | null };

const zoneRow = (year: number, code: string) => and(eq(zones.year, year), eq(zones.code, code));

/**
 * รหัส/รหัสย่อนี้เคยเป็นของโซนที่ลบไปแล้วในปีนี้ (แถว removed): โซนที่ผู้ดูแลเพิ่ม → ลบแถวทิ้ง
 * โซนเริ่มต้น → เปลี่ยนรหัสแถวเป็น ~รหัส (ยังเก็บไว้ ไม่ให้ระบบใส่โซนเริ่มต้นกลับ)
 */
async function freeRemovedZone(tx: Tx, year: number, code: string, key: string) {
  const rows = (await tx.select().from(zones).where(and(eq(zones.year, year), eq(zones.removed, true)))).filter((z) => z.code === code || z.key === key);
  for (const z of rows) {
    if (z.baseCode) await tx.update(zones).set({ code: `~${z.baseCode}`.slice(0, 32), key: `~${z.key}`.slice(0, 16) }).where(zoneRow(year, z.code));
    else await tx.delete(zones).where(zoneRow(year, z.code));
  }
}

function assertZoneUnique(zoneList: ZoneDef[], self: string | null, code: string, key: string, sheetPrefix: string | null) {
  const others = zoneList.filter((z) => z.code !== self);
  if (others.some((z) => z.code.toLowerCase() === code.toLowerCase())) throw new Error(`มีโซนรหัส ${code} อยู่แล้ว`);
  if (others.some((z) => z.key.toLowerCase() === key.toLowerCase())) throw new Error(`รหัส ${code} ซ้ำกับโซนอื่น (ส่วนหลัง Zone- คือ ${key})`);
  if (sheetPrefix && others.some((z) => z.sheetPrefix === sheetPrefix)) throw new Error(`ชื่อชีต "${sheetPrefix}" ใช้กับโซนอื่นอยู่แล้ว`);
}

/** เพิ่มโซนในปีนี้ · ชื่อในผังว่าง = ใช้รหัส */
export async function createZone(db: Db, year: number, code: string, input: Partial<ZoneInput> & { label: string }) {
  const key = zoneKeyOf(code);
  return db.transaction(async (tx) => {
    const sheetPrefix = input.sheetPrefix || null;
    assertZoneUnique(await listZones(tx, year), null, code, key, sheetPrefix);
    const categories = await listCategories(tx, year);
    await assertCodesFree(tx, year, [code, ...categories.map((c) => groupNodeCode(DEFAULT_ORG.code, { key }, c))]);
    await freeRemovedZone(tx, year, code, key);
    const [{ last }] = await tx.select({ last: max(zones.sortOrder) }).from(zones).where(eq(zones.year, year));
    const row = { year, code, key, name: input.name?.trim() || code, label: input.label.trim(), sheetPrefix, sortOrder: (last ?? -1) + 1 };
    await tx.insert(zones).values(row);
    await rebuild(tx, year);
    return row;
  });
}

/** แก้โซนของปีนี้ รวมถึงรหัสโซน — รหัสในผัง (Zone-X, Sz-X, Op-X ทุกหน่วยงาน) และค่าที่อ้างโซนนี้เปลี่ยนตาม */
export async function updateZone(db: Db, year: number, code: string, input: ZoneInput & { code: string }) {
  const newCode = input.code;
  const newKey = zoneKeyOf(newCode);
  await db.transaction(async (tx) => {
    const zoneList = await listZones(tx, year);
    const current = zoneList.find((z) => z.code === code);
    if (!current) throw new Error("ไม่พบโซน");
    const sheetPrefix = input.sheetPrefix || null;
    assertZoneUnique(zoneList, code, newCode, newKey, sheetPrefix);

    if (newCode !== code) {
      const [orgs, categories] = await Promise.all([listOrganizations(tx, year), listCategories(tx, year)]);
      const map = new Map<string, string>();
      for (const org of orgs) {
        map.set(zoneNodeCode(org.code, current), zoneNodeCode(org.code, { code: newCode }));
        for (const c of categories) map.set(groupNodeCode(org.code, current, c), groupNodeCode(org.code, { key: newKey }, c));
      }
      await moveUnitCodes(tx, year, map);
      await freeRemovedZone(tx, year, newCode, newKey);
      await tx.update(unitOverrides).set({ zoneCode: newCode }).where(and(eq(unitOverrides.year, year), eq(unitOverrides.zoneCode, code)));
      await tx.update(detectedUnits).set({ zoneCode: newCode }).where(and(eq(detectedUnits.year, year), eq(detectedUnits.zoneCode, code)));
    }
    await tx
      .update(zones)
      .set({ code: newCode, key: newKey, name: input.name.trim(), label: input.label.trim(), sheetPrefix })
      .where(zoneRow(year, code));
    await rebuild(tx, year);
  });
}

/**
 * ลบโซนของปีนี้: ต้องไม่มีหน่วยในผังอยู่ในโซนนี้ (ย้ายไปโซนอื่นก่อน) · หน่วยใหม่ที่รอเลือกประเภทในโซนนี้ → กลับเป็นไม่ระบุโซน
 * สิทธิ์ผู้ใช้ที่ผูกกับโซน/กลุ่มของโซนนี้ถูกลบตอนแทนผัง (ถ้าไม่มีปีอื่นใช้รหัสนั้นแล้ว)
 */
export async function deleteZone(db: Db, year: number, code: string) {
  await db.transaction(async (tx) => {
    if (!(await listZones(tx, year)).some((z) => z.code === code)) throw new Error("ไม่พบโซน");
    const n = (await currentLeaves(tx, year)).filter((l) => l.zoneCode === code).length;
    if (n) throw inUse(n, "โซน", "ย้ายหน่วยไปโซนอื่น (หน้า Sales Zone / Operations ปุ่ม แก้ไข) ");
    await tx
      .update(detectedUnits)
      .set({ zoneCode: null })
      .where(and(eq(detectedUnits.year, year), eq(detectedUnits.zoneCode, code), isNull(detectedUnits.category)));
    await tx.update(zones).set({ removed: true }).where(zoneRow(year, code));
    await rebuild(tx, year);
  });
}

// ---------- หน่วยงาน ----------

/**
 * แก้หน่วยงานของปีนี้: ชื่อ (ทุกหน่วยงาน) และรหัส (เฉพาะหน่วยงานที่ผู้ดูแลเพิ่ม — รหัสหน่วยงานเริ่มต้นระบบใช้แยกผังหลัก)
 * หน่วยงานเริ่มต้นเก็บชื่อที่แก้เป็นแถวรหัสเดียวกันในตาราง organizations
 */
export async function updateOrganization(db: Db, year: number, code: string, input: { code: string; name: string }) {
  const name = input.name.trim();
  const newCode = input.code;
  await db.transaction(async (tx) => {
    const all = await listOrganizations(tx, year);
    if (!all.some((o) => o.code === code)) throw new Error("ไม่พบหน่วยงาน");
    if (all.some((o) => o.code !== code && o.name === name)) throw new Error(`มีหน่วยงานชื่อ "${name}" อยู่แล้ว`);

    if (newCode !== code) {
      if (code === DEFAULT_ORG.code) throw new Error("รหัสหน่วยงานเริ่มต้นแก้ไม่ได้ (แก้ชื่อได้)");
      if (newCode.toUpperCase() === DEFAULT_ORG.code || all.some((o) => o.code !== code && o.code.toLowerCase() === newCode.toLowerCase())) {
        throw new Error(`มีหน่วยงานรหัส ${newCode} อยู่แล้ว`);
      }
      const zoneList = await listZones(tx, year);
      const categories = await listCategories(tx, year);
      const map = new Map<string, string>([[orgNodeCode(code), orgNodeCode(newCode)]]);
      for (const z of zoneList) {
        map.set(zoneNodeCode(code, z), zoneNodeCode(newCode, z));
        for (const c of categories) map.set(groupNodeCode(code, z, c), groupNodeCode(newCode, z, c));
      }
      await moveUnitCodes(tx, year, map);
      await tx.update(unitOverrides).set({ orgCode: newCode }).where(and(eq(unitOverrides.year, year), eq(unitOverrides.orgCode, code)));
      await tx.update(detectedUnits).set({ orgCode: newCode }).where(and(eq(detectedUnits.year, year), eq(detectedUnits.orgCode, code)));
    }

    const thisOrg = and(eq(organizations.year, year), eq(organizations.code, code));
    const [row] = await tx.select().from(organizations).where(thisOrg);
    if (row) await tx.update(organizations).set({ code: newCode, name }).where(thisOrg);
    else await tx.insert(organizations).values({ year, code, name });
    await rebuild(tx, year);
  });
}

/** ลบหน่วยงานของปีนี้: หน่วยงานเริ่มต้นลบไม่ได้ · ต้องไม่มีหน่วยในผัง · ค่าที่ชี้มาหน่วยงานนี้ (หน่วยรอเลือก/ค่าแก้ทับ) กลับเป็นหน่วยงานเริ่มต้น */
export async function deleteOrganization(db: Db, year: number, code: string) {
  if (code === DEFAULT_ORG.code) throw new Error("หน่วยงานเริ่มต้นลบไม่ได้ (แก้ชื่อได้)");
  await db.transaction(async (tx) => {
    if (!(await listOrganizations(tx, year)).some((o) => o.code === code)) throw new Error("ไม่พบหน่วยงาน");
    const n = (await currentLeaves(tx, year)).filter((l) => l.orgCode === code).length;
    if (n) throw inUse(n, "หน่วยงาน", "ย้ายหน่วยไปหน่วยงานอื่น (หน้า Sales Zone / Operations ปุ่ม แก้ไข) ");
    await tx.update(detectedUnits).set({ orgCode: null }).where(and(eq(detectedUnits.year, year), eq(detectedUnits.orgCode, code)));
    await tx.update(unitOverrides).set({ orgCode: null }).where(and(eq(unitOverrides.year, year), eq(unitOverrides.orgCode, code)));
    await tx.delete(organizations).where(and(eq(organizations.year, year), eq(organizations.code, code)));
    await rebuild(tx, year);
  });
}
