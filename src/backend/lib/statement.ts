// โมเดลงบกำไรขาดทุนที่ Dashboard ใช้: แถวและตัวเลข (ยอดเงิน + %) ตามที่บันทึกในตาราง statement_lines ระบบไม่คำนวณยอดรวมเอง
// ผังบัญชีด้านล่างใช้จัดหมวดค่าใช้จ่ายและตั้งชื่อบัญชีมาตรฐานเท่านั้น ไม่ได้ใช้คิดตัวเลข
// (การอ่านไฟล์นำเข้าถูกรื้อออก รอรูปแบบไฟล์ใหม่ — ดู src/backend/lib/import-workbook.ts)

export type Section = "revenue" | "cogs" | "other_cost" | "selling" | "admin" | "finance" | "allocation";

export type Account = { code: string; name: string; section: Section };

export type TotalKey =
  | "REV" | "GOODS_AVAIL" | "COGS" | "OTHER_AVAIL" | "OTHER_COST" | "TOTAL_COST" | "GP"
  | "SELLING" | "ADMIN" | "SGA" | "OP" | "PBT";

const TOTAL_KEYS: TotalKey[] = ["REV", "GOODS_AVAIL", "COGS", "OTHER_AVAIL", "OTHER_COST", "TOTAL_COST", "GP", "SELLING", "ADMIN", "SGA", "OP", "PBT"];

const MAJOR_TOTALS = new Set<TotalKey>(["REV", "GP", "OP", "PBT"]);

const ACCOUNT_LIST: [code: string, name: string, section: Section][] = [
  ["A", "รายได้จากการขาย", "revenue"],
  ["B", "รายได้จากการขาย-อาหาร", "revenue"],
  ["C", "รายได้อื่น", "revenue"],
  ["M", "ส่วนลดรับ", "revenue"],
  ["AA", "สินค้าคงเหลือต้นงวด", "cogs"],
  ["D", "ซื้อ-หมูขุน/ไก่/วัว/ปลา", "cogs"],
  ["E", "ซื้อ-ชิ้นส่วนหมู/ไก่/วัว เพื่อขาย", "cogs"],
  ["F", "ซื้ออาหารแช่แข็ง", "cogs"],
  ["G", "ซื้อของขายอื่นๆ", "cogs"],
  ["XX", "ต้นทุนขาย", "cogs"],
  ["XZ", "Shopping Bag", "cogs"],
  ["XQ", "ยอดสูญเสีย", "cogs"],
  ["XW", "บัญชีพักยอดสูญเสีย", "cogs"],
  ["XY", "บัญชีพักต้นทุน", "cogs"],
  ["FF", "ค่าจ้างแหละ", "cogs"],
  ["H", "ค่าจ้าง-TJC", "cogs"],
  ["I", "ค่าจ้าง-จับไก่/ ค่าขนส่ง", "cogs"],
  ["AB", "สินค้าปลายงวด", "cogs"],
  ["BA", "อาหารและยาคงต้นงวด", "other_cost"],
  ["J", "ซื้ออาหาร", "other_cost"],
  ["K", "ซื้อลูกไก่", "other_cost"],
  // อยู่ใน Flow การคำนวณแต่ยังไม่มีในไฟล์ตัวอย่าง — ชื่อชั่วคราวจนกว่าจะรู้ชื่อบัญชีจริง
  ["KK", "ต้นทุนอื่น (KK)", "other_cost"],
  ["L", "ค่าขนเข้า", "other_cost"],
  ["BB", "อาหารและยาปลายงวด", "other_cost"],
  ["N", "ค่าใช้จ่ายในการเดินทางและยานพาหนะ", "selling"],
  ["O", "ค่าอาญาบ้ตร", "selling"],
  ["P", "ค่าส่งเสริมการขาย", "selling"],
  ["Q", "ค่าใช้จ่ายการขายอื่นๆ", "selling"],
  ["R", "เงินเดือนและค่าจ้าง", "admin"],
  ["S", "ค่าใช้จ่ายเกี่ยวกับพนักงาน", "admin"],
  ["T", "ค่าไฟฟ้า,ค่าน้ำประปา,สื่อสาร", "admin"],
  ["U", "ค่าธรรมเนียม,ที่ปรึกษา", "admin"],
  ["V", "ค่าน้ำมันรถ", "admin"],
  ["W", "ค่าจ้างบริการ", "admin"],
  ["X", "ค่าเช่า", "admin"],
  ["Y", "ค่าซ่อมแซมและบำรุงรักษา", "admin"],
  ["Z", "ค่าใช้จ่ายอื่นๆ", "admin"],
  ["ZZ", "ค่าเสื่อมราคา", "finance"],
  ["ZZZ", "ดอกเบี้ยจ่าย", "finance"],
];

export const ACCOUNTS: Account[] = ACCOUNT_LIST.map(([code, name, section]) => ({ code, name, section }));

// ---------- แถวของงบที่บันทึกไว้ ----------

export type LineKind = "heading" | "account" | "total";

/** หนึ่งแถวของงบ ตามลำดับที่นำเข้า (lineNo = ลำดับแถว) */
export type FileLine = {
  lineNo: number;
  kind: LineKind;
  groupCode: string | null;
  totalKey: TotalKey | null;
  label: string;
  indent: boolean;
  amount: number | null;
  pct: number | null;
};

// ---------- งบที่พร้อมแสดง ----------

export type ComputedLine =
  | { kind: "heading"; name: string }
  | { kind: "account"; code: string; name: string; indent: boolean; value: number; pctOfRevenue: number | null }
  | { kind: "total"; key: TotalKey | null; name: string; emphasis: "minor" | "major"; value: number; pctOfRevenue: number | null };

export type Statement = { lines: ComputedLine[]; totals: Record<TotalKey, number> };

const zeroTotals = () => Object.fromEntries(TOTAL_KEYS.map((k) => [k, 0])) as Record<TotalKey, number>;

export const emptyStatement = (): Statement => ({ lines: [], totals: zeroTotals() });

/** สร้างงบจากแถวที่บันทึกไว้ตรงๆ — ยอดเงิน ยอดรวม และ % ใช้ค่าที่นำเข้ามาทั้งหมด */
export function statementFromLines(lines: FileLine[]): Statement {
  const totals = zeroTotals();
  const out: ComputedLine[] = [...lines].sort((a, b) => a.lineNo - b.lineNo).map((l) => {
    if (l.kind === "heading") return { kind: "heading", name: l.label };
    const value = l.amount ?? 0;
    if (l.kind === "account") {
      return { kind: "account", code: l.groupCode ?? "", name: l.label, indent: l.indent, value, pctOfRevenue: l.pct };
    }
    if (l.totalKey) totals[l.totalKey] = value;
    const emphasis = l.totalKey && MAJOR_TOTALS.has(l.totalKey) ? "major" : "minor";
    return { kind: "total", key: l.totalKey, name: l.label, emphasis, value, pctOfRevenue: l.pct };
  });
  return { lines: out, totals };
}

/**
 * แถวที่แสดงในการ์ดงบ — ซ่อนแถวที่เป็น 0 ไม่ให้เป็นจุดโฟกัสตอนประชุม:
 * บัญชีที่เป็น 0 · หัวข้อที่ไม่มีบัญชีเหลือ · ยอดรวมย่อยที่เป็น 0 ในหมวดที่ไม่มีบัญชีเหลือ (เช่น ต้นทุนขายอื่นๆ ทั้งหมวด)
 * ยอดรวมหลัก (รายได้ กำไรขั้นต้น กำไรจากการดำเนินงาน กำไรก่อนภาษี) แสดงเสมอ · ยอดรวมย่อยที่เป็น 0 แต่หมวดยังมีบัญชี (หักลบกันพอดี) ยังแสดง
 * หมวด = แถวตั้งแต่หัวข้อจนถึงหัวข้อถัดไปหรือยอดรวมหลัก (ค่าเสื่อม/ดอกเบี้ยหลังกำไรจากการดำเนินงานไม่นับเป็นหมวดบริหาร)
 */
export function visibleStatementLines(lines: ComputedLine[]): ComputedLine[] {
  const sectionOf: number[] = [];
  const filled = [false];
  for (const line of lines) {
    if (line.kind === "heading") filled.push(false);
    sectionOf.push(filled.length - 1);
    if (line.kind === "account" && line.value !== 0) filled[filled.length - 1] = true;
    if (line.kind === "total" && line.emphasis === "major") filled.push(false);
  }
  return lines.filter((line, i) => {
    if (line.kind === "heading") return filled[sectionOf[i]];
    if (line.kind === "account") return line.value !== 0;
    return line.emphasis === "major" || line.value !== 0 || filled[sectionOf[i]];
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * รวมงบหลายงวด (มุมมองสะสม YTD และการเลือกดูหลายเดือนรวมกัน): บวกตัวเลขของแถวเดียวกันข้ามเดือน
 * % ของงวดสะสมไม่มีในไฟล์ จึงต้องคิดจากรายได้รวมสะสม
 */
export function sumStatements(list: Statement[]): Statement {
  if (list.length === 0) return emptyStatement();
  const keyOf = (l: Exclude<ComputedLine, { kind: "heading" }>) => (l.kind === "account" ? `a:${l.code}` : `t:${l.key ?? l.name}`);
  const sums = new Map<string, number>();
  for (const s of list) {
    for (const l of s.lines) if (l.kind !== "heading") sums.set(keyOf(l), (sums.get(keyOf(l)) ?? 0) + l.value);
  }
  const totals = zeroTotals();
  for (const k of TOTAL_KEYS) totals[k] = round2(list.reduce((sum, s) => sum + s.totals[k], 0));
  const pct = (v: number) => (totals.REV === 0 ? null : (v / totals.REV) * 100);
  // ใช้โครงแถวของงวดล่าสุด
  const lines = list[list.length - 1].lines.map((l): ComputedLine => {
    if (l.kind === "heading") return l;
    const value = round2(sums.get(keyOf(l)) ?? 0);
    return { ...l, value, pctOfRevenue: pct(value) };
  });
  return { lines, totals };
}

/** สินค้าคงเหลือต้นงวด/ปลายงวด และยอดรวม "สินค้ามีไว้เพื่อขาย" ที่ขึ้นกับยอดนั้น */
const OPENING: Record<string, TotalKey> = { AA: "GOODS_AVAIL", BA: "OTHER_AVAIL" };
const CLOSING = new Set(["AB", "BB"]);

/**
 * รวมงบหลายงวดต่อเนื่องแบบคอลัมน์ "รวมทั้งหมด" ของชีต Monthy: บวกทุกแถว ยกเว้นสินค้าคงเหลือ
 * ต้นงวด (AA, BA) = ของงวดแรก · ปลายงวด (AB, BB) = ของงวดสุดท้าย · สินค้ามีไว้เพื่อขายหักส่วนต้นงวดที่บวกซ้ำออก
 * ต้นทุนขายและกำไรเท่ากับผลบวกรายเดือน (ต้นงวดของเดือนถัดไป = ปลายงวดของเดือนก่อน) · list เรียงเก่า → ใหม่
 */
export function sumPeriodStatements(list: Statement[]): Statement {
  const sum = sumStatements(list);
  if (list.length < 2) return sum;
  const valueOf = (s: Statement, code: string) => {
    const l = s.lines.find((x) => x.kind === "account" && x.code === code);
    return l && l.kind === "account" ? l.value : 0;
  };
  const pct = (v: number) => (sum.totals.REV === 0 ? null : (v / sum.totals.REV) * 100);
  const adjust = new Map<TotalKey, number>();
  for (const [code, key] of Object.entries(OPENING)) {
    adjust.set(key, (adjust.get(key) ?? 0) + valueOf(list[0], code) - valueOf(sum, code));
  }
  const totals = { ...sum.totals };
  for (const [key, d] of adjust) totals[key] = round2(totals[key] + d);
  const lines = sum.lines.map((l): ComputedLine => {
    if (l.kind === "account" && (l.code in OPENING || CLOSING.has(l.code))) {
      const value = valueOf(l.code in OPENING ? list[0] : list[list.length - 1], l.code);
      return { ...l, value, pctOfRevenue: pct(value) };
    }
    if (l.kind === "total" && l.key && adjust.has(l.key)) return { ...l, value: totals[l.key], pctOfRevenue: pct(totals[l.key]) };
    return l;
  });
  return { lines, totals };
}
