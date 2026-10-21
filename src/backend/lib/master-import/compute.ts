// คำนวณงบกำไรขาดทุนจากยอดรวมต่อ Group (ยอดราย Group ของแต่ละสาขาในชีตงบ) ตาม Flow ของไฟล์ Excel
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล — ใช้ทั้งตอนตรวจไฟล์ ตอนนำเข้า และตอนคำนวณใหม่หลังแทนผังหน่วย
import { buildClosure } from "../authz/scope";
import { ACCOUNTS, type LineKind, type Section, type TotalKey } from "../statement";

/** ยอดรวมต่อ Group ของหน่วยหนึ่ง เช่น { A: 1000, XX: 600 } */
export type GroupAmounts = Record<string, number>;

/** หมวดที่ผู้ดูแลเลือกให้ Group ใหม่ได้ — ยอดของ Group ใหม่บวกเข้าหมวดเสมอ (finance หักจากกำไรจากการดำเนินงาน) */
export type GroupSection = Exclude<Section, "allocation">;

export const GROUP_SECTIONS: { section: GroupSection; label: string }[] = [
  { section: "revenue", label: "รายได้" },
  { section: "cogs", label: "ต้นทุนขาย" },
  { section: "other_cost", label: "ต้นทุนขายอื่นๆ" },
  { section: "selling", label: "ค่าใช้จ่ายในการขาย" },
  { section: "admin", label: "ค่าใช้จ่ายในการบริหาร" },
  { section: "finance", label: "รายการใต้กำไรจากการดำเนินงาน (ค่าเสื่อม/ดอกเบี้ย)" },
];

/** Group ที่ไม่อยู่ใน Flow ในโค้ด แต่ผู้ดูแลเลือกหมวดแล้ว (ตาราง detected_groups) */
export type ExtraGroup = { code: string; name: string; section: GroupSection };

/** แถวยอดรวมที่ Group ใหม่ของแต่ละหมวดแทรกไว้ก่อนหน้า (ท้ายหมวด) */
const SECTION_ANCHOR: Record<GroupSection, TotalKey> = {
  revenue: "REV", cogs: "GOODS_AVAIL", other_cost: "OTHER_AVAIL", selling: "SELLING", admin: "ADMIN", finance: "PBT",
};
const INDENTED = new Set<GroupSection>(["cogs", "other_cost"]);

/**
 * XW (บัญชีพักยอดสูญเสีย) และ XY (บัญชีพักต้นทุน) ของสำนักงานใหญ่ หักล้างกับ XQ/XX ที่โอนไปให้สาขา จึงต้องติดลบเสมอ
 * ไฟล์ Excel บางเดือนบันทึกเป็นบวกแล้วสูตรคูณ −1 บางเดือนบันทึกเป็นลบมาแล้ว — ใช้ −|ยอด| ให้ได้ผลเดียวกันทั้งสองแบบ
 */
const ALWAYS_NEGATIVE = new Set(["XW", "XY"]);

/** ปรับเครื่องหมายตามกฎของไฟล์ ใช้กับยอดรวมของหน่วยล่างสุดก่อนรวมขึ้นหน่วยแม่ */
export function normalizeGroups(groups: GroupAmounts): GroupAmounts {
  const out: GroupAmounts = {};
  for (const [g, v] of Object.entries(groups)) out[g] = ALWAYS_NEGATIVE.has(g) ? -Math.abs(v) : v;
  return out;
}

type TemplateRow =
  | { kind: "heading"; label: string }
  | { kind: "account"; group: string; indent?: boolean }
  | { kind: "total"; key: TotalKey; label: string };

const acc = (group: string, indent = false): TemplateRow => ({ kind: "account", group, indent });
const total = (key: TotalKey, label: string): TemplateRow => ({ kind: "total", key, label });
const heading = (label: string): TemplateRow => ({ kind: "heading", label });

/** โครงงบตามชีตงบในไฟล์ Excel (ลำดับและชื่อเดิม) — ยอดรวมคิดตาม TOTALS ด้านล่าง */
const TEMPLATE: TemplateRow[] = [
  acc("A"), acc("B"), acc("C"), acc("M"),
  total("REV", "รายได้รวม"),
  heading("ต้นทุนขาย"),
  acc("AA"), acc("D", true), acc("E", true), acc("F", true), acc("G", true), acc("XX", true), acc("XZ", true),
  acc("XQ", true), acc("XW", true), acc("XY", true), acc("FF", true), acc("H", true), acc("I", true),
  total("GOODS_AVAIL", "สินค้ามีไว้เพื่อขาย"),
  acc("AB"),
  total("COGS", "รวมต้นทุนขาย"),
  heading("ต้นทุนขายอื่นๆ"),
  acc("BA"), acc("J", true), acc("K", true), acc("KK", true), acc("L", true),
  total("OTHER_AVAIL", "สินค้ามีไว้เพื่อขาย"),
  acc("BB"),
  total("OTHER_COST", "รวมต้นทุนอื่น"),
  total("TOTAL_COST", "รวมต้นทุนเพื่อขาย"),
  total("GP", "กำไรขั้นต้น (Gross Profit)"),
  heading("ค่าใช้จ่ายในการขายและบริหาร"),
  heading("ค่าใช้จ่ายในการขาย"),
  acc("N"), acc("O"), acc("P"), acc("Q"),
  total("SELLING", "รวมค่าใช้จ่ายขาย"),
  heading("ค่าใช้จ่ายในการบริหาร"),
  acc("R"), acc("S"), acc("T"), acc("U"), acc("V"), acc("W"), acc("X"), acc("Y"), acc("Z"),
  total("ADMIN", "รวมค่าใช้จ่ายบริหาร"),
  total("SGA", "รวมค่าใช้จ่ายในการขายและบริหาร"),
  total("OP", "กำไร(ขาดทุน) จากการดำเนินงาน"),
  acc("ZZ"), acc("ZZZ"),
  total("PBT", "กำไร(ขาดทุน) ก่อนภาษี"),
];

/** Group ทั้งหมดที่ Flow ในโค้ดรู้จัก — Group อื่นในไฟล์เป็น Group ใหม่ (รอผู้ดูแลเลือกหมวด ยังไม่นับในงบ) */
export const KNOWN_GROUPS = new Set(TEMPLATE.flatMap((r) => (r.kind === "account" ? [r.group] : [])));

/** Group ที่นับในงบ = Flow ในโค้ด + Group ใหม่ที่เลือกหมวดแล้ว */
export const knownGroups = (extra: ExtraGroup[] = []) => new Set([...KNOWN_GROUPS, ...extra.map((e) => e.code)]);

/** โครงงบพร้อมแถว Group ใหม่ แทรกท้ายหมวดของตัวเอง (ก่อนแถวยอดรวมของหมวด) */
function templateFor(extra: ExtraGroup[]): TemplateRow[] {
  if (extra.length === 0) return TEMPLATE;
  return TEMPLATE.flatMap((row) => {
    if (row.kind !== "total") return [row];
    const added = extra.filter((e) => SECTION_ANCHOR[e.section] === row.key).map((e) => acc(e.code, INDENTED.has(e.section)));
    return [...added, row];
  });
}

const accountName = new Map(ACCOUNTS.map((a) => [a.code, a.name]));
const accountSection = new Map(ACCOUNTS.map((a) => [a.code, a.section as GroupSection]));

/** ผลของ Group ต่อยอดรวม (แสดงในหน้า Group ของแอปหลังบ้าน) */
const SECTION_EFFECT: Record<GroupSection, string> = {
  revenue: "บวกเข้า รายได้รวม",
  cogs: "บวกเข้า สินค้ามีไว้เพื่อขาย → รวมต้นทุนขาย",
  other_cost: "บวกเข้า สินค้ามีไว้เพื่อขาย (ต้นทุนอื่น) → รวมต้นทุนอื่น",
  selling: "บวกเข้า รวมค่าใช้จ่ายขาย",
  admin: "บวกเข้า รวมค่าใช้จ่ายบริหาร",
  finance: "หักจาก กำไรจากการดำเนินงาน → กำไรก่อนภาษี",
};
const SPECIAL_EFFECT: Record<string, string> = {
  AB: "หักจาก สินค้ามีไว้เพื่อขาย → รวมต้นทุนขาย (สินค้าปลายงวด)",
  BB: "หักจาก สินค้ามีไว้เพื่อขาย (ต้นทุนอื่น) → รวมต้นทุนอื่น (ปลายงวด)",
  XW: `${SECTION_EFFECT.cogs} (ติดลบเสมอ)`,
  XY: `${SECTION_EFFECT.cogs} (ติดลบเสมอ)`,
};

export type GroupPlacement = { code: string; defaultName: string; section: GroupSection; effect: string; inFlow: boolean; order: number };

/** Group ทุกตัวที่นับในงบ ตามลำดับแถวในงบ: Flow ในโค้ด + Group ใหม่ที่เลือกหมวดแล้ว (แทรกท้ายหมวด) */
export function groupPlacements(extra: ExtraGroup[] = []): GroupPlacement[] {
  const extraOf = new Map(extra.map((e) => [e.code, e]));
  return templateFor(extra).flatMap((row) => (row.kind === "account" ? [row.group] : [])).map((code, order) => {
    const e = extraOf.get(code);
    const section = e?.section ?? accountSection.get(code)!;
    return {
      code,
      defaultName: e?.name ?? accountName.get(code) ?? code,
      section,
      effect: (!e && SPECIAL_EFFECT[code]) || SECTION_EFFECT[section],
      inFlow: !e,
      order,
    };
  });
}

/** Flow ใน PreView_ForClaude/รายได้.txt + Group ใหม่ที่เลือกหมวดแล้ว (บวกเข้ายอดรวมของหมวด) */
export function computeTotals(g: GroupAmounts, extra: ExtraGroup[] = []): Record<TotalKey, number> {
  const sum = (...codes: string[]) => codes.reduce((s, c) => s + (g[c] ?? 0), 0);
  const ext = (section: GroupSection) => sum(...extra.filter((e) => e.section === section).map((e) => e.code));
  const REV = sum("A", "B", "C", "M") + ext("revenue");
  const GOODS_AVAIL = sum("AA", "D", "E", "F", "G", "XX", "XZ", "XQ", "XW", "XY", "FF", "H", "I") + ext("cogs");
  const COGS = GOODS_AVAIL - sum("AB");
  const OTHER_AVAIL = sum("BA", "J", "K", "KK", "L") + ext("other_cost");
  const OTHER_COST = OTHER_AVAIL - sum("BB");
  const TOTAL_COST = COGS + OTHER_COST;
  const GP = REV - TOTAL_COST;
  const SELLING = sum("N", "O", "P", "Q") + ext("selling");
  const ADMIN = sum("R", "S", "T", "U", "V", "W", "X", "Y", "Z") + ext("admin");
  const SGA = SELLING + ADMIN;
  const OP = GP - SGA;
  const PBT = OP - sum("ZZ", "ZZZ") - ext("finance");
  return { REV, GOODS_AVAIL, COGS, OTHER_AVAIL, OTHER_COST, TOTAL_COST, GP, SELLING, ADMIN, SGA, OP, PBT };
}

/** หนึ่งแถวของงบที่คำนวณแล้ว — รูปแบบเดียวกับตาราง statement_lines (ตัวเลขเป็นข้อความทศนิยม) */
export type ComputedRow = {
  lineNo: number;
  kind: LineKind;
  groupCode: string | null;
  totalKey: TotalKey | null;
  label: string;
  indent: boolean;
  amount: string | null;
  pct: string | null;
};

/**
 * งบเต็มของหน่วยหนึ่ง: % = ยอด ÷ รายได้รวมของหน่วยนั้น × 100 (ไม่มีรายได้ = ไม่มี %)
 * fileTotals = ยอดรวมตามไฟล์ที่ผู้นำเข้าเลือกใช้แทนยอดที่คำนวณ (รายได้รวมตามไฟล์ใช้เป็นฐาน % ด้วย)
 * extra = Group ใหม่ที่ผู้ดูแลเลือกหมวดแล้ว (มีแถวของตัวเองในงบ) · rename = ชื่อที่ผู้ดูแลแก้ทับชื่อบัญชีใน Flow
 */
export function computeStatement(
  g: GroupAmounts,
  fileTotals?: Partial<Record<TotalKey, number>>,
  extra: ExtraGroup[] = [],
  rename: Record<string, string> = {},
): ComputedRow[] {
  const totals = { ...computeTotals(g, extra), ...fileTotals };
  const pct = (v: number) => (totals.REV === 0 ? null : ((v / totals.REV) * 100).toFixed(4));
  const names = new Map([...accountName, ...Object.entries(rename), ...extra.map((e) => [e.code, e.name] as const)]);
  return templateFor(extra).map((row, i) => {
    const lineNo = i + 1;
    if (row.kind === "heading") {
      return { lineNo, kind: "heading", groupCode: null, totalKey: null, label: row.label, indent: false, amount: null, pct: null };
    }
    const value = row.kind === "account" ? (g[row.group] ?? 0) : totals[row.key];
    return {
      lineNo,
      kind: row.kind,
      groupCode: row.kind === "account" ? row.group : null,
      totalKey: row.kind === "total" ? row.key : null,
      label: row.kind === "account" ? (names.get(row.group) ?? row.group) : row.label,
      indent: row.kind === "account" && !!row.indent,
      amount: value.toFixed(2),
      pct: pct(value),
    };
  });
}

/**
 * หน่วยในผังที่ "ตรงกับชีต" = หน่วยที่หน่วยล่างสุดใต้ตัวเอง (เฉพาะที่มียอด) เป็นชุดเดียวกับคอลัมน์หน่วยในชีตที่อยู่ในผัง
 * เช่น ชีตน่าน (NAN-HO + สาขา) → Zone-NAN · ชีตเชียงใหม่ (สาขาล้วน) → Sz-CMI · ชีตงบรวม → MSP และหน่วยงานที่มีหน่วยครบ
 * คอลัมน์ที่ไม่อยู่ในผัง (หน่วยใหม่ที่ยังไม่เลือกประเภท) ไม่นับ · ไม่มีหน่วยที่ตรง = []
 */
export function nodesForSheet(
  tree: { code: string; parentCode: string | null }[],
  sheetLeaves: string[],
  dataLeaves: Set<string>,
): string[] {
  const parents = new Set(tree.map((u) => u.parentCode));
  const treeLeaves = new Set(tree.filter((u) => !parents.has(u.code)).map((u) => u.code));
  const target = new Set(sheetLeaves.filter((c) => treeLeaves.has(c) && dataLeaves.has(c)));
  if (target.size === 0) return [];
  const below = new Map<string, Set<string>>();
  for (const { ancestor, descendant } of buildClosure(tree)) {
    if (!treeLeaves.has(descendant) || !dataLeaves.has(descendant)) continue;
    below.set(ancestor, (below.get(ancestor) ?? new Set()).add(descendant));
  }
  return [...below].filter(([, set]) => set.size === target.size && [...set].every((c) => target.has(c))).map(([code]) => code);
}

/**
 * ยอดต่อ Group ของทุกหน่วยในผัง: หน่วยแม่ = ผลรวมของตัวเองและลูกหลานทั้งหมด
 * Flow เป็นการบวกลบล้วน จึงได้ผลเท่ากับการรวมงบของหน่วยลูก (ตรงกับคอลัมน์รวมในไฟล์ Excel)
 * คืนเฉพาะหน่วยที่มีข้อมูล (ตัวเองหรือลูกหลานมียอดในไฟล์)
 */
export function rollup(
  tree: { code: string; parentCode: string | null }[],
  leafGroups: Map<string, GroupAmounts>,
): Map<string, GroupAmounts> {
  const out = new Map<string, GroupAmounts>();
  for (const { ancestor, descendant } of buildClosure(tree)) {
    const own = leafGroups.get(descendant);
    if (!own) continue;
    const target = out.get(ancestor) ?? {};
    for (const [g, v] of Object.entries(own)) target[g] = (target[g] ?? 0) + v;
    out.set(ancestor, target);
  }
  return out;
}
