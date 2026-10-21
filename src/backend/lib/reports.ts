import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/backend/db";
import { companyMonthly, statementLines, unitClosure, units, type UnitCategory } from "@/backend/db/schema";
import { inYear, listExtraGroups, listGroupRenames } from "./import-workbook";
import { computeStatement, type GroupAmounts } from "./master-import/compute";
import { ROOT_CODE } from "./master-import/units";
import { emptyStatement, statementFromLines, sumStatements, type FileLine, type Statement } from "./statement";
import type { CurrentUser } from "./session";

// ทุกฟังก์ชันในไฟล์นี้รับ user และกรองด้วย user.allowedUnits — ห้าม query ตาราง statement_lines จากที่อื่น

export class ForbiddenUnitError extends Error {}

function assertCanSee(user: CurrentUser, unitCode: string) {
  if (!user.allowedUnits.has(unitCode)) throw new ForbiddenUnitError(`ไม่มีสิทธิ์ดูหน่วย ${unitCode}`);
}

const allowedList = (user: CurrentUser) => [...user.allowedUnits];

export async function listPeriods(user: CurrentUser): Promise<string[]> {
  if (user.allowedUnits.size === 0) return [];
  const rows = await db
    .selectDistinct({ period: statementLines.period })
    .from(statementLines)
    .where(inArray(statementLines.unitCode, allowedList(user)))
    .orderBy(desc(statementLines.period));
  return rows.map((r) => r.period);
}

/**
 * งวดที่แต่ละหน่วยมีข้อมูล (รหัสหน่วย → ชุดงวด) — ใช้ให้ตัวกรองเดือนกับตัวกรองสาขากรองกันเอง
 * statement_lines มีแถวของหน่วยเฉพาะงวดที่หน่วยนั้น (หรือลูกหลาน) มียอดในไฟล์
 */
export async function periodsByUnit(user: CurrentUser, unitCodes: string[]): Promise<Map<string, Set<string>>> {
  const codes = unitCodes.filter((c) => user.allowedUnits.has(c));
  const out = new Map<string, Set<string>>();
  if (codes.length === 0) return out;
  const rows = await db
    .selectDistinct({ unitCode: statementLines.unitCode, period: statementLines.period })
    .from(statementLines)
    .where(inArray(statementLines.unitCode, codes));
  for (const r of rows) out.set(r.unitCode, (out.get(r.unitCode) ?? new Set()).add(r.period));
  return out;
}

export type UnitTotals = { REV: number; GP: number; PBT: number };

/** ยอดรวมหลัก (รายได้ กำไรขั้นต้น กำไรก่อนภาษี) ของหลายหน่วยทุกงวด: งวด → รหัสหน่วย → ยอด (ใช้ทำกราฟรายเดือน) */
export async function monthlyTotals(user: CurrentUser, unitCodes: string[]): Promise<Map<string, Map<string, UnitTotals>>> {
  const codes = unitCodes.filter((c) => user.allowedUnits.has(c));
  const out = new Map<string, Map<string, UnitTotals>>();
  if (codes.length === 0) return out;
  const rows = await db
    .select({ period: statementLines.period, unitCode: statementLines.unitCode, key: statementLines.totalKey, amount: statementLines.amount })
    .from(statementLines)
    .where(and(inArray(statementLines.unitCode, codes), inArray(statementLines.totalKey, ["REV", "GP", "PBT"])));
  for (const r of rows) {
    const byUnit = out.get(r.period) ?? new Map<string, UnitTotals>();
    const t = byUnit.get(r.unitCode) ?? { REV: 0, GP: 0, PBT: 0 };
    t[r.key as keyof UnitTotals] = Number(r.amount ?? 0);
    byUnit.set(r.unitCode, t);
    out.set(r.period, byUnit);
  }
  return out;
}

const GROUP_KEYS = ["REV", "GP", "TOTAL_COST", "SGA", "OP", "PBT"] as const;
export type GroupTotals = Record<(typeof GROUP_KEYS)[number], number>;

/**
 * ยอดรวมหลักของหลายหน่วยบวกกัน รายเดือน เฉพาะงวดที่ขอ: งวด → ยอด — งวดที่ไม่มีหน่วยใดมีงบ ไม่มีในผลลัพธ์
 * ใช้กับกราฟ Timeline ของการ์ด KPI (src/frontend/components/kpi-timeline)
 */
export async function monthlyGroupTotals(user: CurrentUser, unitCodes: string[], periods: string[]): Promise<Map<string, GroupTotals>> {
  const codes = unitCodes.filter((c) => user.allowedUnits.has(c));
  const out = new Map<string, GroupTotals>();
  if (codes.length === 0 || periods.length === 0) return out;
  const rows = await db
    .select({ period: statementLines.period, key: statementLines.totalKey, amount: statementLines.amount })
    .from(statementLines)
    .where(and(inArray(statementLines.unitCode, codes), inArray(statementLines.period, periods), inArray(statementLines.totalKey, [...GROUP_KEYS])));
  for (const r of rows) {
    const t = out.get(r.period) ?? { REV: 0, GP: 0, TOTAL_COST: 0, SGA: 0, OP: 0, PBT: 0 };
    t[r.key as keyof GroupTotals] += Number(r.amount ?? 0);
    out.set(r.period, t);
  }
  return out;
}

export type UnitInfo = { code: string; name: string; level: number; parentCode: string | null };

/**
 * ผังหน่วยแยกตามปี — Dashboard จัดหน่วยตามผังของปีเดือนล่าสุดที่เลือก (ตัวเลขแต่ละเดือนคำนวณด้วยผังของปีเดือนนั้นอยู่แล้ว)
 * งวดที่เลือก → ปี ค.ศ. ของผังที่ใช้
 */
export const treeYearOf = (sel: PeriodSel) => Number((typeof sel === "string" ? sel : [...sel].sort().at(-1)!).slice(0, 4));

/** หน่วยที่เลือก + เส้นทางจากหน่วยบนสุดที่ผู้ใช้เห็นได้ ตามผังของปีนี้ (สำหรับ breadcrumb) */
export async function getUnitPath(user: CurrentUser, year: number, unitCode: string): Promise<UnitInfo[]> {
  assertCanSee(user, unitCode);
  const ancestors = db
    .select({ code: unitClosure.ancestor })
    .from(unitClosure)
    .where(and(eq(unitClosure.year, year), eq(unitClosure.descendant, unitCode)));
  const rows = await db
    .select({ code: units.code, name: units.name, level: units.level, parentCode: units.parentCode })
    .from(units)
    .where(and(eq(units.year, year), inArray(units.code, ancestors)))
    .orderBy(asc(units.level));
  return rows.filter((r) => user.allowedUnits.has(r.code));
}

const lineColumns = {
  unitCode: statementLines.unitCode,
  period: statementLines.period,
  lineNo: statementLines.lineNo,
  kind: statementLines.kind,
  groupCode: statementLines.groupCode,
  totalKey: statementLines.totalKey,
  label: statementLines.label,
  indent: statementLines.indent,
  amount: statementLines.amount,
  pct: statementLines.pct,
};

type LineRow = { unitCode: string; period: string; amount: string | null; pct: string | null } & Omit<FileLine, "amount" | "pct">;

const toFileLine = (r: LineRow): FileLine => ({
  ...r,
  amount: r.amount == null ? null : Number(r.amount),
  pct: r.pct == null ? null : Number(r.pct),
});

/**
 * งวดที่ดู: เดือนเดียว ("2026-08-01") หรือหลายเดือนรวมกัน (["2026-01-01", "2026-02-01"])
 * หลายเดือน = บวกงบของแต่ละเดือนด้วย sumStatements (% คิดใหม่จากรายได้รวม)
 */
export type PeriodSel = string | string[];

/** งบของแต่ละหน่วย อ่านจากแถวในไฟล์ตรงๆ (หน่วยระดับบนใช้คอลัมน์รวมของไฟล์ ไม่บวกจากหน่วยลูก) */
async function statementsByUnit(sel: PeriodSel, unitCodes: string[]): Promise<Map<string, Statement>> {
  if (unitCodes.length === 0) return new Map();
  const periods = typeof sel === "string" ? [sel] : sel;
  if (periods.length === 0) return new Map(unitCodes.map((c) => [c, emptyStatement()]));
  const rows = await db
    .select(lineColumns)
    .from(statementLines)
    .where(and(inArray(statementLines.period, periods), inArray(statementLines.unitCode, unitCodes)));

  // หน่วย → งวด → แถว
  const byUnit = new Map<string, Map<string, FileLine[]>>();
  for (const r of rows) {
    const perUnit = byUnit.get(r.unitCode) ?? new Map<string, FileLine[]>();
    perUnit.set(r.period, [...(perUnit.get(r.period) ?? []), toFileLine(r)]);
    byUnit.set(r.unitCode, perUnit);
  }
  const build = (perUnit: Map<string, FileLine[]>): Statement => {
    // เรียงเก่า → ใหม่: sumStatements ใช้โครงแถวของงวดล่าสุด
    const list = [...perUnit.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, lines]) => statementFromLines(lines));
    return list.length === 1 ? list[0] : sumStatements(list);
  };
  return new Map(unitCodes.map((c) => [c, byUnit.has(c) ? build(byUnit.get(c)!) : emptyStatement()]));
}

export async function getStatement(user: CurrentUser, period: PeriodSel, unitCode: string): Promise<Statement> {
  assertCanSee(user, unitCode);
  return (await statementsByUnit(period, [unitCode])).get(unitCode)!;
}

/** งบของหลายหน่วย (ข้ามหน่วยที่ไม่มีสิทธิ์เห็น) */
export async function getStatements(user: CurrentUser, period: PeriodSel, unitCodes: string[]): Promise<Map<string, Statement>> {
  return statementsByUnit(period, unitCodes.filter((c) => user.allowedUnits.has(c)));
}

export type UnitNode = UnitInfo & { sortOrder: number; hasChildren: boolean; category: UnitCategory | null };

/**
 * หน่วยที่ผู้ใช้เห็นได้และมีข้อมูลในไฟล์ Master เรียงตามผังของปีนี้ (แม่ก่อนลูก)
 * หน่วยที่ไม่มีงบเลยไม่แสดงในรายงาน · periods = นับเฉพาะหน่วยที่มีงบในงวดเหล่านี้ (ผังของปีมีหน่วยที่ไม่มีข้อมูลในปีนั้นด้วย)
 */
export async function listUnits(user: CurrentUser, year: number, periods?: string[]): Promise<UnitNode[]> {
  if (user.allowedUnits.size === 0 || periods?.length === 0) return [];
  const withData = db
    .selectDistinct({ code: statementLines.unitCode })
    .from(statementLines)
    .where(periods ? inArray(statementLines.period, periods) : undefined);
  const rows = await db
    .select({ code: units.code, name: units.name, level: units.level, parentCode: units.parentCode, sortOrder: units.sortOrder, category: units.category })
    .from(units)
    .where(and(eq(units.year, year), inArray(units.code, allowedList(user)), inArray(units.code, withData)));
  const parents = new Set(rows.map((r) => r.parentCode));
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentCode && user.allowedUnits.has(r.parentCode) ? r.parentCode : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: UnitNode[] = [];
  const visit = (parent: string | null) => {
    for (const r of (byParent.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)) {
      out.push({ ...r, hasChildren: parents.has(r.code) });
      visit(r.code);
    }
  };
  visit(null);
  return out;
}

export type PeriodStatement = { period: string; statement: Statement };

/** งบของหน่วยเดียวทุกงวด เรียงจากเก่าไปใหม่ (ใช้ทำแนวโน้ม เทียบงวด และ YTD) */
export async function getHistory(user: CurrentUser, unitCode: string): Promise<PeriodStatement[]> {
  assertCanSee(user, unitCode);
  const rows = await db.select(lineColumns).from(statementLines).where(eq(statementLines.unitCode, unitCode));

  const byPeriod = new Map<string, FileLine[]>();
  for (const r of rows) byPeriod.set(r.period, [...(byPeriod.get(r.period) ?? []), toFileLine(r)]);
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, lines]) => ({ period, statement: statementFromLines(lines) }));
}

// ---------- ภาพรวมบริษัท (ชีต Monthy) ----------

/** ผู้ใช้เห็นภาพรวมทั้งบริษัทได้เมื่อมีสิทธิ์ดูหน่วยบนสุด (MSP) */
export const canSeeCompany = (user: CurrentUser) => user.allowedUnits.has(ROOT_CODE);

/** ปี ค.ศ. ที่มีข้อมูลจากชีต Monthy เรียงใหม่ → เก่า */
export async function listCompanyYears(user: CurrentUser): Promise<number[]> {
  if (!canSeeCompany(user)) return [];
  const rows = await db.selectDistinct({ period: companyMonthly.period }).from(companyMonthly);
  return [...new Set(rows.map((r) => Number(r.period.slice(0, 4))))].sort((a, b) => b - a);
}

/**
 * งบทั้งบริษัทรายเดือนของปีนี้จากชีต Monthy เรียง ม.ค. → ธ.ค. (เฉพาะเดือนที่มีตัวเลข)
 * คำนวณด้วย Flow และชื่อบัญชีชุดเดียวกับงบของหน่วย · ไม่มีสิทธิ์ดูหน่วยบนสุด = null
 */
export async function getCompanyMonthly(user: CurrentUser, year: number): Promise<PeriodStatement[] | null> {
  if (!canSeeCompany(user)) return null;
  const [rows, extra, rename] = await Promise.all([
    db.select().from(companyMonthly).where(inYear(companyMonthly.period, year)),
    listExtraGroups(db, year),
    listGroupRenames(db, year),
  ]);
  const byPeriod = new Map<string, GroupAmounts>();
  for (const r of rows) {
    const g = byPeriod.get(r.period) ?? {};
    g[r.groupCode] = Number(r.amount);
    byPeriod.set(r.period, g);
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, g]) => ({
      period,
      statement: statementFromLines(
        computeStatement(g, undefined, extra, rename).map((l) => ({
          ...l,
          amount: l.amount == null ? null : Number(l.amount),
          pct: l.pct == null ? null : Number(l.pct),
        })),
      ),
    }));
}

export type CompanyPeriod = PeriodStatement & {
  /** monthy = ชีต Monthy · msp = งบของหน่วยบนสุด (ปีที่ไฟล์ Master ไม่มีชีต Monthy) */
  source: "monthy" | "msp";
};

/**
 * งบทั้งบริษัททุกเดือนที่มีในระบบ เรียงเก่า → ใหม่
 * เดือนที่มีในชีต Monthy ใช้ชีต Monthy · เดือนอื่น (เช่นปีที่ไฟล์ไม่มีชีตนี้) ใช้งบของหน่วยบนสุด MSP · ไม่มีสิทธิ์ = []
 */
export async function getCompanyHistory(user: CurrentUser): Promise<CompanyPeriod[]> {
  if (!canSeeCompany(user)) return [];
  const [years, root] = await Promise.all([listCompanyYears(user), getHistory(user, ROOT_CODE)]);
  const monthy = (await Promise.all(years.map((y) => getCompanyMonthly(user, y)))).flatMap((h) => h ?? []);
  const have = new Set(monthy.map((h) => h.period));
  return [
    ...monthy.map((h) => ({ ...h, source: "monthy" as const })),
    ...root.filter((h) => !have.has(h.period)).map((h) => ({ ...h, source: "msp" as const })),
  ].sort((a, b) => a.period.localeCompare(b.period));
}

export type ChildSummary = UnitInfo & { hasChildren: boolean; statement: Statement };

/** งบของหน่วยลูกแต่ละหน่วย (ที่ผู้ใช้เห็นได้) ใต้หน่วยที่เลือก ตามผังของปีเดือนล่าสุดที่เลือก */
export async function getChildren(user: CurrentUser, period: PeriodSel, unitCode: string): Promise<ChildSummary[]> {
  assertCanSee(user, unitCode);
  const year = treeYearOf(period);
  const children = (
    await db
      .select({ code: units.code, name: units.name, level: units.level, parentCode: units.parentCode })
      .from(units)
      .where(and(eq(units.year, year), eq(units.parentCode, unitCode)))
      .orderBy(asc(units.sortOrder))
  ).filter((c) => user.allowedUnits.has(c.code));

  const statements = await statementsByUnit(period, children.map((c) => c.code));
  const grandChildren = children.length
    ? await db
      .selectDistinct({ parentCode: units.parentCode })
      .from(units)
      .where(and(eq(units.year, year), inArray(units.parentCode, children.map((c) => c.code))))
    : [];
  const parents = new Set(grandChildren.map((g) => g.parentCode));
  // ผังหน่วยเก็บหน่วยจากไฟล์เก่าไว้ด้วย — ไม่แสดงหน่วยที่ไม่มีข้อมูลในงวดนี้ (ไม่มีงบ ≠ งบเป็นศูนย์)
  return children
    .filter((c) => statements.get(c.code)!.lines.length > 0)
    .map((c) => ({
      ...c,
      hasChildren: parents.has(c.code),
      statement: statements.get(c.code)!,
    }));
}
