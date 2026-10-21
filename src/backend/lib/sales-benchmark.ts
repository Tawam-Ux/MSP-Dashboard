import { and, between, eq, inArray } from "drizzle-orm";
import type { Db } from "@/backend/db";
import { branchAreas, groupAmounts, units, zoneSalesBenchmarks } from "@/backend/db/schema";

// เกณฑ์ "รายได้จากการขายต่อ ตร.ม." ของ Sales Zone
// เกณฑ์ของโซน = รายได้จากการขาย (Group A) รวม ÷ ตร.ม. รวม — นับเฉพาะสาขาที่มี Group A > 0 และมีข้อมูล ตร.ม.
// แต่ละสาขาเทียบด้วย Group A ของสาขา ÷ ตร.ม. ของสาขา (บาท/ตร.ม. หน่วยเดียวกับเกณฑ์)
// ไม่รวม Group B (รายได้จากการขาย-อาหาร), C (รายได้อื่น), M (ส่วนลดรับ)

/** รหัส Group ของรายได้จากการขาย (คอลัมน์ A ในชีตงบ) */
export const SALES_GROUP = "A";

/** Db หรือ transaction (ใช้ได้ทั้งสองแบบ) */
type Tx = Pick<Db, "select" | "insert" | "delete">;

export type SalesInput = { code: string; salesA: number; area: number | null };
export type SalesBenchmark = {
  salesA: number;
  area: number;
  /** จำนวนสาขาที่นับในเกณฑ์ */
  branchCount: number;
  /** null = ไม่มีสาขาที่นับได้ (ไม่มี Group A หรือไม่มี ตร.ม. เลย) */
  perSqm: number | null;
};

const counts = (r: SalesInput) => r.salesA > 0 && r.area != null && r.area > 0;

/** รายได้ต่อ ตร.ม. ของสาขา · null = ไม่มีข้อมูล ตร.ม. */
export const branchPerSqm = (salesA: number, area: number | null | undefined) => (area != null && area > 0 ? salesA / area : null);

/** สูตรเดียวที่ใช้ทั้งตอนบันทึกลงตาราง และตอนคิดสด (เลือกหลายเดือน) */
export function computeSalesBenchmark(rows: SalesInput[]): SalesBenchmark {
  const counted = rows.filter(counts);
  const salesA = counted.reduce((s, r) => s + r.salesA, 0);
  const area = counted.reduce((s, r) => s + (r.area ?? 0), 0);
  return { salesA, area, branchCount: counted.length, perSqm: area > 0 ? salesA / area : null };
}

/** ตร.ม. ที่เปลี่ยนเมื่อแทนชุดเดิมด้วยชีต Branch_Area · before null = สาขาใหม่ · after null = ไม่มีในไฟล์ (จะถูกลบ) */
export type AreaChange = { code: string; name: string; before: number | null; after: number | null; source: "file" | "admin" | null };

/** เทียบ ตร.ม. ที่บันทึกไว้กับชีต Branch_Area ของไฟล์ใหม่ (เทียบที่ทศนิยม 2 ตำแหน่งตามที่เก็บในตาราง) — เฉพาะรายการที่ต่างกัน */
export function diffBranchAreas(
  saved: { code: string; name: string; area: number; source: "file" | "admin" }[],
  incoming: { code: string; name: string; area: number }[],
): AreaChange[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const old = new Map(saved.map((s) => [s.code, s]));
  const fresh = new Set(incoming.map((r) => r.code));
  const changed = incoming.flatMap((r) => {
    const s = old.get(r.code);
    if (s && round(s.area) === round(r.area)) return [];
    return [{ code: r.code, name: r.name || s?.name || "", before: s ? s.area : null, after: r.area, source: s?.source ?? null }];
  });
  const removed = saved
    .filter((s) => !fresh.has(s.code))
    .map((s) => ({ code: s.code, name: s.name, before: s.area, after: null, source: s.source }));
  return [...changed, ...removed];
}

/** ตร.ม. ของสาขาในปีนี้ (รหัสหน่วย → ตร.ม.) */
export async function readBranchAreas(db: Pick<Db, "select">, year: number, codes?: string[]): Promise<Map<string, number>> {
  if (codes && codes.length === 0) return new Map();
  const rows = await db
    .select({ code: branchAreas.unitCode, area: branchAreas.areaSqm })
    .from(branchAreas)
    .where(and(eq(branchAreas.year, year), codes ? inArray(branchAreas.unitCode, codes) : undefined));
  return new Map(rows.map((r) => [r.code, Number(r.area)]));
}

/**
 * ตร.ม.×เดือน ของแต่ละสาขาในงวดที่เลือกหลายเดือน = ผลรวม ตร.ม. (ของปีของเดือนนั้น) เฉพาะเดือนที่สาขามี Group A > 0
 * ใช้เป็นตัวหารแทน ตร.ม. เมื่อเลือกหลายเดือน → เกณฑ์เป็น บาท/ตร.ม./เดือน สาขาที่เพิ่งเปิดกลางช่วงไม่ถูกหารด้วยเดือนที่ยังไม่เปิด
 * null = มีเดือนที่ขายแต่ไม่มี ตร.ม. (เทียบไม่ได้) · ไม่มีในผล = ไม่มี Group A ในงวดที่เลือก
 */
export async function salesAreaMonths(db: Pick<Db, "select">, periods: string[], codes: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (periods.length === 0 || codes.length === 0) return out;
  const sold = await db
    .select({ period: groupAmounts.period, code: groupAmounts.unitCode, amount: groupAmounts.amount })
    .from(groupAmounts)
    .where(and(eq(groupAmounts.groupCode, SALES_GROUP), inArray(groupAmounts.period, periods), inArray(groupAmounts.unitCode, codes)));
  const years = [...new Set(periods.map((p) => Number(p.slice(0, 4))))];
  const areaByYear = new Map(await Promise.all(years.map(async (y) => [y, await readBranchAreas(db, y, codes)] as const)));
  for (const s of sold) {
    if (Number(s.amount) <= 0 || out.get(s.code) === null) continue;
    const area = areaByYear.get(Number(s.period.slice(0, 4)))?.get(s.code);
    out.set(s.code, area != null && area > 0 ? (out.get(s.code) ?? 0) + area : null);
  }
  return out;
}

/**
 * คำนวณเกณฑ์ของทุกโซนขายทุกงวดของปีนี้จาก group_amounts (Group A ของหน่วยล่างสุด) + ตร.ม. + ผังหน่วยของปีนี้ แล้วแทนเกณฑ์ของปีนั้น
 * โซน = หน่วยแม่ของสาขาประเภท sales · เรียกท้าย recomputeStatements และหลังแก้ ตร.ม.
 */
export async function recomputeSalesBenchmarks(tx: Tx, year: number): Promise<number> {
  const first = `${year}-01-01`;
  const last = `${year}-12-01`;
  const [branches, amounts, areas] = await Promise.all([
    tx.select({ code: units.code, parentCode: units.parentCode }).from(units).where(and(eq(units.year, year), eq(units.category, "sales"))),
    tx.select({ period: groupAmounts.period, code: groupAmounts.unitCode, amount: groupAmounts.amount })
      .from(groupAmounts)
      .where(and(eq(groupAmounts.groupCode, SALES_GROUP), between(groupAmounts.period, first, last))),
    readBranchAreas(tx, year),
  ]);
  const zoneOf = new Map(branches.flatMap((b) => (b.parentCode ? [[b.code, b.parentCode] as const] : [])));

  // งวด|โซน → สาขาในโซนที่มียอด Group A ในงวดนั้น
  const groups = new Map<string, SalesInput[]>();
  for (const a of amounts) {
    const zone = zoneOf.get(a.code);
    if (!zone) continue;
    const key = `${a.period}|${zone}`;
    groups.set(key, [...(groups.get(key) ?? []), { code: a.code, salesA: Number(a.amount), area: areas.get(a.code) ?? null }]);
  }

  const rows: (typeof zoneSalesBenchmarks.$inferInsert)[] = [];
  for (const [key, list] of groups) {
    const b = computeSalesBenchmark(list);
    if (b.perSqm == null) continue;
    const [period, zoneCode] = key.split("|");
    rows.push({ period, zoneCode, salesA: b.salesA.toFixed(2), areaSqm: b.area.toFixed(2), branchCount: b.branchCount, bahtPerSqm: b.perSqm.toFixed(4) });
  }
  await tx.delete(zoneSalesBenchmarks).where(between(zoneSalesBenchmarks.period, first, last));
  if (rows.length) await tx.insert(zoneSalesBenchmarks).values(rows);
  return rows.length;
}

/**
 * เกณฑ์ของโซนสำหรับงวดที่เลือก
 * เดือนเดียว = อ่านจากตารางที่บันทึกไว้ · หลายเดือน = คิดสดด้วยสูตรเดียวกัน (Group A รวมของเดือนที่เลือก ÷ ตร.ม.×เดือน จาก salesAreaMonths)
 * branches = สาขาทั้งโซน (ไม่กรอง) พร้อม Group A ของงวดที่เลือก · หลายเดือน area = ตร.ม.×เดือน
 */
export async function getZoneSalesBenchmark(
  db: Pick<Db, "select">,
  periods: string[],
  zoneCode: string,
  branches: SalesInput[],
): Promise<SalesBenchmark> {
  if (periods.length === 1) {
    const [row] = await db
      .select()
      .from(zoneSalesBenchmarks)
      .where(and(eq(zoneSalesBenchmarks.period, periods[0]), eq(zoneSalesBenchmarks.zoneCode, zoneCode)))
      .limit(1);
    return row
      ? { salesA: Number(row.salesA), area: Number(row.areaSqm), branchCount: row.branchCount, perSqm: Number(row.bahtPerSqm) }
      : { salesA: 0, area: 0, branchCount: 0, perSqm: null };
  }
  return computeSalesBenchmark(branches);
}
