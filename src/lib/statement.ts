// โครงสร้างงบกำไรขาดทุนตามไฟล์ Excel ต้นทาง
// เก็บเฉพาะบัญชีที่มีรหัส (ข้อมูลจริง) ส่วนยอดรวมทั้งหมดคำนวณจากสูตรด้านล่าง

export type Section = "revenue" | "cogs" | "other_cost" | "selling" | "admin" | "finance" | "allocation";

export type Account = { code: string; name: string; section: Section };

export type StatementLine =
  | { kind: "heading"; name: string }
  | { kind: "account"; code: string; name: string; indent: boolean }
  | { kind: "total"; key: TotalKey; name: string; terms: Term[]; emphasis: "minor" | "major" };

type Term = [sign: 1 | -1, ref: string];

export type TotalKey =
  | "REV" | "GOODS_AVAIL" | "COGS" | "OTHER_AVAIL" | "OTHER_COST" | "TOTAL_COST" | "GP"
  | "SELLING" | "ADMIN" | "SGA" | "OP" | "PBT";

const acc = (code: string, name: string, indent = false): StatementLine => ({ kind: "account", code, name, indent });
const total = (key: TotalKey, name: string, terms: Term[], emphasis: "minor" | "major" = "minor"): StatementLine => ({
  kind: "total", key, name, terms, emphasis,
});
const plus = (...refs: string[]): Term[] => refs.map((r) => [1, r]);

export const STATEMENT: StatementLine[] = [
  { kind: "heading", name: "รายได้" },
  acc("A", "รายได้จากการขาย"),
  acc("B", "รายได้จากการขาย-อาหาร"),
  acc("C", "รายได้อื่น"),
  acc("M", "ส่วนลดรับ"),
  total("REV", "รายได้รวม", plus("A", "B", "C", "M"), "major"),

  { kind: "heading", name: "ต้นทุนขาย" },
  acc("AA", "สินค้าคงเหลือต้นงวด"),
  acc("D", "ซื้อ-หมูขุน/ไก่/วัว/ปลา", true),
  acc("E", "ซื้อ-ชิ้นส่วนหมู/ไก่/วัว เพื่อขาย", true),
  acc("F", "ซื้ออาหารแช่แข็ง", true),
  acc("G", "ซื้อของขายอื่นๆ", true),
  acc("XX", "ต้นทุนขาย", true),
  acc("XZ", "Shopping Bag", true),
  acc("XQ", "ยอดสูญเสีย", true),
  acc("XW", "บัญชีพักยอดสูญเสีย", true),
  acc("XY", "บัญชีพักต้นทุน", true),
  acc("FF", "ค่าจ้างแหละ", true),
  acc("H", "ค่าจ้าง-TJC", true),
  acc("I", "ค่าจ้าง-จับไก่/ ค่าขนส่ง", true),
  total("GOODS_AVAIL", "สินค้ามีไว้เพื่อขาย", plus("AA", "D", "E", "F", "G", "XX", "XZ", "XQ", "XW", "XY", "FF", "H", "I")),
  acc("AB", "สินค้าปลายงวด"),
  total("COGS", "รวมต้นทุนขาย", [[1, "GOODS_AVAIL"], [-1, "AB"]]),

  { kind: "heading", name: "ต้นทุนขายอื่นๆ" },
  acc("BA", "อาหารและยาคงต้นงวด"),
  acc("J", "ซื้ออาหาร", true),
  acc("K", "ซื้อลูกไก่", true),
  acc("L", "ค่าขนเข้า", true),
  total("OTHER_AVAIL", "อาหารและยามีไว้ใช้", plus("BA", "J", "K", "L")),
  acc("BB", "อาหารและยาปลายงวด"),
  total("OTHER_COST", "รวมต้นทุนอื่น", [[1, "OTHER_AVAIL"], [-1, "BB"]]),
  total("TOTAL_COST", "รวมต้นทุนเพื่อขาย", plus("COGS", "OTHER_COST")),
  total("GP", "กำไรขั้นต้น", [[1, "REV"], [-1, "TOTAL_COST"]], "major"),

  { kind: "heading", name: "ค่าใช้จ่ายในการขาย" },
  acc("N", "ค่าใช้จ่ายในการเดินทางและยานพาหนะ"),
  acc("O", "ค่าอาญาบ้ตร"),
  acc("P", "ค่าส่งเสริมการขาย"),
  acc("Q", "ค่าใช้จ่ายการขายอื่นๆ"),
  total("SELLING", "รวมค่าใช้จ่ายขาย", plus("N", "O", "P", "Q")),

  { kind: "heading", name: "ค่าใช้จ่ายในการบริหาร" },
  acc("R", "เงินเดือนและค่าจ้าง"),
  acc("S", "ค่าใช้จ่ายเกี่ยวกับพนักงาน"),
  acc("T", "ค่าไฟฟ้า,ค่าน้ำประปา,สื่อสาร"),
  acc("U", "ค่าธรรมเนียม,ที่ปรึกษา"),
  acc("V", "ค่าน้ำมันรถ"),
  acc("W", "ค่าจ้างบริการ"),
  acc("X", "ค่าเช่า"),
  acc("Y", "ค่าซ่อมแซมและบำรุงรักษา"),
  acc("Z", "ค่าใช้จ่ายอื่นๆ"),
  total("ADMIN", "รวมค่าใช้จ่ายบริหาร", plus("R", "S", "T", "U", "V", "W", "X", "Y", "Z")),
  total("SGA", "รวมค่าใช้จ่ายในการขายและบริหาร", plus("SELLING", "ADMIN")),
  total("OP", "กำไร(ขาดทุน) จากการดำเนินงาน", [[1, "GP"], [-1, "SGA"]], "major"),

  acc("ZZ", "ค่าเสื่อมราคา"),
  acc("ZZZ", "ดอกเบี้ยจ่าย"),
  total("PBT", "กำไร(ขาดทุน) ก่อนภาษี", [[1, "OP"], [-1, "ZZ"], [-1, "ZZZ"]], "major"),

  // แถวปันส่วน HQ: ยังไม่ทราบเครื่องหมายที่ถูกต้อง จึงแสดงเป็นข้อมูลอย่างเดียว ไม่นำไปคิดยอดรวม
  { kind: "heading", name: "ปันส่วน HQ (ข้อมูลประกอบ)" },
  acc("HQ-REV", "รายได้ปันส่วน HQ"),
  acc("HQ-COGS", "ต้นทุนขายปันส่วน HQ"),
  acc("HQ-EXP", "ค่าใช้จ่ายปันส่วน HQ"),
];

const SECTION_BY_HEADING: Record<string, Section> = {
  "รายได้": "revenue",
  "ต้นทุนขาย": "cogs",
  "ต้นทุนขายอื่นๆ": "other_cost",
  "ค่าใช้จ่ายในการขาย": "selling",
  "ค่าใช้จ่ายในการบริหาร": "admin",
};

export const ACCOUNTS: Account[] = (() => {
  const out: Account[] = [];
  let section: Section = "revenue";
  for (const line of STATEMENT) {
    if (line.kind === "heading") section = SECTION_BY_HEADING[line.name] ?? "allocation";
    if (line.kind === "total" && line.key === "SGA") section = "finance";
    if (line.kind === "account") out.push({ code: line.code, name: line.name, section });
  }
  return out;
})();

export const ACCOUNT_CODES = new Set(ACCOUNTS.map((a) => a.code));

export type ComputedLine =
  | { kind: "heading"; name: string }
  | { kind: "account"; code: string; name: string; indent: boolean; value: number; pctOfRevenue: number | null }
  | { kind: "total"; key: TotalKey; name: string; emphasis: "minor" | "major"; value: number; pctOfRevenue: number | null };

export type Statement = { lines: ComputedLine[]; totals: Record<TotalKey, number> };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeStatement(amounts: Record<string, number>): Statement {
  const values: Record<string, number> = {};
  for (const line of STATEMENT) {
    if (line.kind === "account") values[line.code] = amounts[line.code] ?? 0;
    if (line.kind === "total") values[line.key] = round2(line.terms.reduce((s, [sign, ref]) => s + sign * (values[ref] ?? 0), 0));
  }
  const revenue = values.REV;
  const pct = (v: number) => (revenue === 0 ? null : (v / revenue) * 100);

  const lines: ComputedLine[] = STATEMENT.map((line) => {
    if (line.kind === "heading") return line;
    if (line.kind === "account") return { ...line, value: values[line.code], pctOfRevenue: pct(values[line.code]) };
    const { kind, key, name, emphasis } = line;
    return { kind, key, name, emphasis, value: values[key], pctOfRevenue: pct(values[key]) };
  });

  const totals = Object.fromEntries(
    STATEMENT.flatMap((l) => (l.kind === "total" ? [[l.key, values[l.key]]] : [])),
  ) as Record<TotalKey, number>;

  return { lines, totals };
}
