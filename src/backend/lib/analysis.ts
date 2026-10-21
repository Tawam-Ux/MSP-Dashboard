// ฟังก์ชันคำนวณสำหรับหน้า P&L Analysis / Sales Zone / Operations — ไม่แตะฐานข้อมูล
import type { UnitNode } from "./reports";
import { ACCOUNTS, type Section, type Statement } from "./statement";

/** สัดส่วนต่อรายได้ (%) หรือ null ถ้าไม่มีรายได้ */
export const ratioOf = (n: number, revenue: number) => (revenue === 0 ? null : (n / revenue) * 100);

/**
 * อัตราส่วนต่อรายได้ของทั้งกลุ่ม (pooled / ถ่วงน้ำหนักด้วยรายได้) = ผลรวมตัวเลข ÷ ผลรวมรายได้ × 100
 * มาตรฐานของ margin ระดับกลุ่ม: สาขาใหญ่มีน้ำหนักตามยอดขาย สาขาเล็กที่ % สูง/ต่ำผิดปกติไม่ดึงเกณฑ์ทั้งโซน
 * (ต่างจากค่าเฉลี่ยของ % รายสาขา ที่ทุกสาขามีน้ำหนักเท่ากัน)
 */
export const pooledRatio = (rows: { value: number; revenue: number }[]) =>
  ratioOf(rows.reduce((s, r) => s + r.value, 0), rows.reduce((s, r) => s + r.revenue, 0));

/** % เปลี่ยนแปลงเทียบฐาน ใช้ |ฐาน| เพื่อให้ทิศทางถูกเมื่อฐานติดลบ */
export const changePct = (now: number, base: number | null | undefined) =>
  base == null || base === 0 ? null : ((now - base) / Math.abs(base)) * 100;

/** "2026-03-01" → งวดเดียวกันของปีก่อน */
export function sameMonthLastYear(period: string): string {
  const [y, m, d] = period.split("-");
  return `${Number(y) - 1}-${m}-${d}`;
}

const EXPENSE_SECTIONS: Section[] = ["selling", "admin", "finance"];
const EXPENSE_CODES = new Set(ACCOUNTS.filter((a) => EXPENSE_SECTIONS.includes(a.section)).map((a) => a.code));

export type AccountValue = { code: string; name: string; value: number };

/**
 * บัญชีค่าใช้จ่าย (ขาย บริหาร ค่าเสื่อม ดอกเบี้ย) ที่ไม่เป็นศูนย์ เรียงจากมากไปน้อย
 * รวม Group ใหม่ที่ผู้ดูแลเลือกเป็นหมวดค่าใช้จ่าย = แถวบัญชีที่อยู่หลังแถวกำไรขั้นต้นในงบ
 */
export function expenseAccounts(statement: Statement): AccountValue[] {
  let afterGP = false;
  return statement.lines
    .flatMap((l) => {
      if (l.kind === "total" && l.key === "GP") afterGP = true;
      const isExpense = l.kind === "account" && (EXPENSE_CODES.has(l.code) || afterGP);
      return isExpense && l.value !== 0 ? [{ code: l.code, name: l.name, value: l.value }] : [];
    })
    .sort((a, b) => b.value - a.value);
}

/** บัญชีพักที่หักล้างกันเองในระดับบริษัท (ต้นทุนขาย ↔ พักต้นทุน · ยอดสูญเสีย ↔ พักยอดสูญเสีย) — รวมกันเป็น 0 เสมอ */
const INTERNAL_COST_PAIRS = new Set(["XX", "XY", "XQ", "XW"]);
/** สินค้าคงเหลือ: นับเป็นต้นทุนสุทธิ = ต้นงวด − ปลายงวด (แถวเดียว) */
const INVENTORY = [
  { open: "AA", close: "AB", code: "INV", name: "สินค้าคงเหลือสุทธิ" },
  { open: "BA", close: "BB", code: "INV2", name: "อาหารและยาคงเหลือสุทธิ" },
];

/**
 * บัญชีต้นทุน (ต้นทุนขาย + ต้นทุนอื่น) = แถวบัญชีระหว่างรายได้รวมกับกำไรขั้นต้น (รวม Group ใหม่ที่เลือกหมวดต้นทุนแล้ว)
 * value = ผลต่อต้นทุนรวม (บวก = ต้นทุนเพิ่ม) · สินค้าคงเหลือรวมเป็นแถวสุทธิ · ไม่รวมบัญชีพักที่หักล้างกันเอง · เรียงจากมากไปน้อย
 */
export function costAccounts(statement: Statement): AccountValue[] {
  let inCost = false;
  const values = new Map<string, AccountValue>();
  for (const l of statement.lines) {
    if (l.kind === "total" && l.key === "REV") inCost = true;
    if (l.kind === "total" && l.key === "GP") break;
    if (inCost && l.kind === "account" && !INTERNAL_COST_PAIRS.has(l.code)) values.set(l.code, { code: l.code, name: l.name, value: l.value });
  }
  for (const inv of INVENTORY) {
    const open = values.get(inv.open)?.value ?? 0;
    const close = values.get(inv.close)?.value ?? 0;
    values.delete(inv.open);
    values.delete(inv.close);
    if (open !== 0 || close !== 0) values.set(inv.code, { code: inv.code, name: inv.name, value: open - close });
  }
  return [...values.values()].filter((a) => a.value !== 0).sort((a, b) => b.value - a.value);
}

/** ค่าเสื่อมราคา + ดอกเบี้ยจ่าย */
export function financeCost(statement: Statement): number {
  return statement.totals.OP - statement.totals.PBT;
}

/**
 * แบ่งหน่วยล่างสุดเป็นสาขาขาย (Sales Zone) หรือ Operations ตามประเภทในผังหน่วย (units.category จาก master-import/units.ts)
 * โซนขาย = หน่วยแม่ของสาขาขาย · ประเภทของหน่วยที่มีลูกไม่มีผล
 * ไม่ได้ตั้งประเภท → ใช้กฎตามผัง: อยู่ใต้หน่วยที่ลูกทุกตัวเป็นหน่วยล่างสุด = สาขาขาย, นอกนั้น = Operations
 */
export function classifyUnits(nodes: UnitNode[]) {
  const childrenOf = new Map<string, UnitNode[]>();
  for (const n of nodes) if (n.parentCode) childrenOf.set(n.parentCode, [...(childrenOf.get(n.parentCode) ?? []), n]);
  const isTreeZone = (code: string) => {
    const kids = childrenOf.get(code) ?? [];
    return kids.length > 0 && kids.every((k) => !k.hasChildren);
  };

  // ต้องเห็นหน่วยแม่ด้วย ไม่งั้นผู้ใช้ที่เห็นแค่สาขาเดียวจะได้สาขานั้นเป็น "Operations" หรือเป็นโซนที่ไม่มีงบโซน
  const visible = new Set(nodes.map((n) => n.code));
  const leaves = nodes.filter((n) => !n.hasChildren && n.parentCode && visible.has(n.parentCode));
  const categoryOf = (n: UnitNode) => n.category ?? (isTreeZone(n.parentCode!) ? "sales" : "operations");
  const sales = leaves.filter((n) => categoryOf(n) === "sales");
  const zoneCodes = new Set(sales.map((n) => n.parentCode));

  return {
    zones: nodes.filter((n) => zoneCodes.has(n.code)).map((z) => ({ ...z, branches: sales.filter((b) => b.parentCode === z.code) })),
    operations: leaves.filter((n) => categoryOf(n) === "operations"),
  };
}

export const average = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
