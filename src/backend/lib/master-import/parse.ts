import ExcelJS from "exceljs";
import type { BranchAreaRow, ParsedMaster } from "../import-workbook";
import type { TotalKey } from "../statement";
import { computeTotals, knownGroups, normalizeGroups, type ExtraGroup, type GroupAmounts } from "./compute";
import { parseMonthySheet, type ParsedMonthy } from "./monthy";
import { tabColorOf, workbookPalette } from "./tab-color";
import { IMPORT_UNIT_CODES, zoneOfSheet } from "./units";

// รูปแบบไฟล์ (ดู docs/spec.md): อ่านเฉพาะชีตงบที่แท็บสี STATEMENT_SHEET_COLOR — ชีตอื่นในไฟล์ไม่ใช้
// ชื่อชีต = เดือน: "ม.ค." = งบรวม, "เชียงใหม่_ม.ค." = ชีตภูมิภาค · A1 = "MASTER_"
// แถว 1 = รหัสหน่วย, แถว 2 = ชื่อหน่วย, หน่วยละ 3 คอลัมน์ (ยอดเงิน, %, ว่าง) เริ่มที่ C (C = ยอดรวมของชีต)
// คอลัมน์ A = Group, B = รายการ · ดึงยอดราย Group ของทุกคอลัมน์หน่วย
// หน่วยที่ไม่อยู่ในผังที่กำหนดในโค้ด (units.ts) = หน่วยใหม่ที่ตรวจพบ — ยอดเก็บไว้ แต่นับในงบเมื่อผู้ดูแลเลือกประเภทแล้วเท่านั้น
// ยอดรวมของชีตใช้ตรวจเทียบกับที่ระบบคำนวณจากทุกคอลัมน์หน่วยในชีต

export const STATEMENT_SHEET_COLOR = "#002060";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const FIRST_UNIT_COL = 3;
const COLS_PER_UNIT = 3;
const FIRST_DATA_ROW = 3;
const SHEET_MARK = "MASTER_";

/** แถวยอดรวมในคอลัมน์ B ที่ใช้ตรวจ (ชื่อในไฟล์ไม่คงที่ เช่น "ดำเนนงาน" จึงเทียบแบบตัดช่องว่างและดูแค่ต้นข้อความ) */
export const CHECKED_TOTALS: [TotalKey, string][] = [
  ["REV", "รายได้รวม"],
  ["GP", "กำไรขั้นต้น"],
  ["OP", "กำไร(ขาดทุน)จากการ"],
  ["PBT", "กำไร(ขาดทุน)ก่อนภาษี"],
];

export class ImportError extends Error {}

export type Mismatch = {
  month: number; sheet: string; unitCode: string; key: TotalKey; file: number; computed: number;
  /** รหัสหน่วยล่างสุดทุกคอลัมน์ในชีตนี้ (ใช้หาหน่วยในผังที่ตรงกับชีต เมื่อเลือกใช้ยอดรวมตามไฟล์) */
  leaves: string[];
};
/** หน่วยในชีตงบที่ไม่อยู่ในผังในโค้ด · zoneCode เดาจากชีต (null = พบในชีตงบรวม) */
export type DetectedUnit = { code: string; name: string; sheet: string; zoneCode: string | null };

export type ParsedStatement = ParsedMaster & {
  /** เดือนที่มีชีตแต่ยอดรวมเป็น 0 ทั้งหมด (ชีตร่าง หรือไฟล์ไม่ได้บันทึกจาก Excel หลังคำนวณ) */
  emptyMonths: number[];
  /** Group ใหม่ในคอลัมน์ A (ไม่อยู่ใน Flow และยังไม่เลือกหมวด) พร้อมชื่อในคอลัมน์ B และยอดรวม — ยอดเก็บใน months แล้ว แต่ยังไม่นับในงบ */
  unknownGroups: { group: string; name: string; amount: number }[];
  /** ยอดรวมที่ระบบคำนวณได้ไม่ตรงกับแถวยอดรวมในไฟล์ */
  mismatches: Mismatch[];
  /** หน่วยในชีตงบที่ไม่อยู่ในผังในโค้ด (เฉพาะที่มียอด) — ยอดอยู่ใน months แล้ว */
  newUnits: DetectedUnit[];
  /** หน่วยในผังที่ไม่พบในชีตงบของเดือนใดเลย */
  missingUnits: string[];
  /** พื้นที่ ตร.ม. จากชีต Branch_Area · null = ไฟล์ไม่มีชีตนี้ (นำเข้าแล้วคงค่าเดิม) */
  areas: BranchAreaRow[] | null;
  /** แถวในชีต Branch_Area ที่ข้ามไป (รหัสซ้ำ ตร.ม. ไม่ใช่ตัวเลข ฯลฯ) */
  areaIssues: string[];
  /** ภาพรวมรายเดือนทั้งบริษัทจากชีต Monthy (หน้า Overview) · null = ไฟล์ไม่มีชีตนี้ (นำเข้าแล้วคงค่าเดิม) */
  monthy: ParsedMonthy | null;
};

/** ชื่อชีตพื้นที่สาขา (เทียบแบบไม่สนตัวพิมพ์และช่องว่าง) */
export const AREA_SHEET = "Branch_Area";

/**
 * หัวคอลัมน์ของชีต Branch_Area ที่อ่านได้ (เทียบแบบตัดช่องว่าง ไม่สนตัวพิมพ์) — ไทยหรืออังกฤษก็ได้
 * Zone ไม่ได้ใช้: โซนของสาขาอ่านจากผังหน่วยในระบบ
 */
const AREA_HEADERS = {
  code: ["สาขา", "รหัสสาขา", "codebranch", "branchcode"],
  name: ["ชื่อสาขา", "branch", "branchname"],
} as const;
const isAreaHeader = (h: string) => h.startsWith("พื้นที่") || h.includes("ตร.ม") || h === "area" || h.startsWith("area(");

/**
 * อ่านชีต Branch_Area: แถว 1 = หัวคอลัมน์ รหัสสาขา (เช่น CM-101) · ชื่อสาขา (ไม่บังคับ) · พื้นที่ ตร.ม.
 * เช่น "สาขา | ชื่อสาขา | พื้นที่ ตร.ม." หรือ "Zone | Code Branch | Branch | Area"
 * หาคอลัมน์จากชื่อหัว (ลำดับสลับได้) · ไม่มีชีต = null · แถวที่ใช้ไม่ได้ข้ามไปพร้อมเหตุผลใน issues
 */
export function parseBranchAreas(book: ExcelJS.Workbook): { areas: BranchAreaRow[] | null; issues: string[] } {
  const ws = book.worksheets.find((w) => squash(w.name).toLowerCase() === AREA_SHEET.toLowerCase());
  if (!ws) return { areas: null, issues: [] };

  const head = Array.from({ length: ws.columnCount }, (_, i) => squash(text(ws, 1, i + 1)).toLowerCase());
  const col = (test: (h: string) => boolean) => head.findIndex((h) => !!h && test(h)) + 1;
  const codeCol = col((h) => (AREA_HEADERS.code as readonly string[]).includes(h));
  const nameCol = col((h) => (AREA_HEADERS.name as readonly string[]).includes(h));
  const areaCol = col(isAreaHeader);
  if (!codeCol || !areaCol) {
    throw new ImportError(
      `ชีต "${ws.name}": แถว 1 ต้องมีหัวคอลัมน์รหัสสาขา ("สาขา" หรือ "Code Branch") และพื้นที่ ("พื้นที่ ตร.ม." หรือ "Area") — ชื่อสาขาไม่บังคับ`,
    );
  }

  const areas: BranchAreaRow[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const code = text(ws, r, codeCol);
    if (!code) continue;
    const raw = text(ws, r, areaCol).replace(/,/g, "");
    const area = Number(raw);
    if (seen.has(code)) {
      issues.push(`แถว ${r}: สาขา ${code} ซ้ำ — ใช้ค่าแถวแรก`);
      continue;
    }
    if (!raw || !Number.isFinite(area) || area <= 0) {
      issues.push(`แถว ${r}: สาขา ${code} พื้นที่ "${raw || "ว่าง"}" ไม่ใช่ตัวเลขที่มากกว่า 0 — ข้าม`);
      continue;
    }
    seen.add(code);
    areas.push({ code, name: nameCol ? text(ws, r, nameCol) : "", area });
  }
  return { areas, issues };
}

export const thaiMonth = (m: number) => THAI_MONTHS[m - 1];

/** "ม.ค." → งบรวม · "เชียงใหม่_ม.ค." → ชีตภูมิภาค (prefix = "เชียงใหม่") · ชื่ออื่น → null */
export function sheetMonth(name: string): { month: number; prefix: string | null } | null {
  const whole = THAI_MONTHS.indexOf(name.trim());
  if (whole !== -1) return { month: whole + 1, prefix: null };
  const i = name.lastIndexOf("_");
  if (i <= 0) return null;
  const month = THAI_MONTHS.indexOf(name.slice(i + 1).trim());
  return month === -1 ? null : { month: month + 1, prefix: name.slice(0, i) };
}

type Raw = ExcelJS.CellValue;
const isFormula = (v: Raw): v is ExcelJS.CellFormulaValue | ExcelJS.CellSharedFormulaValue =>
  !!v && typeof v === "object" && ("formula" in v || "sharedFormula" in v);
const isError = (v: unknown): v is ExcelJS.CellErrorValue => !!v && typeof v === "object" && "error" in v;

export function text(ws: ExcelJS.Worksheet, row: number, col: number): string {
  let v: unknown = ws.getCell(row, col).value;
  if (isFormula(v as Raw)) v = (v as { result?: unknown }).result;
  if (v == null || isError(v)) return "";
  if (typeof v === "object" && "richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("").trim();
  return String(v).trim();
}

/**
 * ยอดเงินตามที่ไฟล์บันทึกไว้ (ผลของสูตรที่ Excel คำนวณเก็บไว้)
 * exceljs ไม่เก็บผลของสูตรที่คำนวณได้ 0 จึงถือว่าสูตรที่ไม่มีผล = 0
 */
export function amount(ws: ExcelJS.Worksheet, row: number, col: number): number {
  const cell = ws.getCell(row, col);
  let v: unknown = cell.value;
  if (isFormula(v as Raw)) v = (v as { result?: unknown }).result;
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (isError(v)) throw new ImportError(`ชีต "${ws.name}" ช่อง ${cell.address}: สูตรให้ค่า ${v.error} — แก้ในไฟล์ก่อนนำเข้า`);
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new ImportError(`ชีต "${ws.name}" ช่อง ${cell.address}: "${String(v)}" ไม่ใช่ตัวเลข`);
  return n;
}

const stripNumbering = (name: string) => name.replace(/^\d+\s*\.?\s*/, "").trim() || name;
export const squash = (s: string) => s.replace(/\s+/g, "");

type UnitColumn = { col: number; code: string; name: string };

/** คอลัมน์หน่วยถัดจากคอลัมน์รวม (C): แถว 2 มีชื่อหน่วย */
function unitColumns(ws: ExcelJS.Worksheet): UnitColumn[] {
  const out: UnitColumn[] = [];
  for (let col = FIRST_UNIT_COL + COLS_PER_UNIT; col <= ws.columnCount; col += COLS_PER_UNIT) {
    const name = text(ws, 2, col);
    if (!name || name === "%") continue;
    out.push({ col, code: text(ws, 1, col), name });
  }
  return out;
}

/**
 * คอลัมน์ในงบรวมที่อ้างถึงชีตภูมิภาค: แถว 1 เป็นชื่อชีต (เช่น ="เชียงใหม่_"&$B$1 → "เชียงใหม่_ม.ค.")
 * ถ้าสูตรในแถว 1 ให้ค่า error จะประกอบชื่อชีตจากสูตรกับเดือนของชีตแทน
 */
function regionRef(master: ExcelJS.Worksheet, uc: UnitColumn, month: number, sheetNames: Set<string>): string | null {
  if (sheetNames.has(uc.code)) return uc.code;
  const v = master.getCell(1, uc.col).value;
  const formula = (isFormula(v) && "formula" in v ? v.formula : "") ?? "";
  const prefix = formula.match(/"([^"]+)"\s*&/)?.[1];
  const name = prefix ? `${prefix}${thaiMonth(month)}` : null;
  return name && sheetNames.has(name) ? name : null;
}

type AccountRow = { row: number; group: string; label: string };

/** แถวบัญชี (มี Group ในคอลัมน์ A) และแถวยอดรวมที่ใช้ตรวจ — อ่านถึงแถวกำไรก่อนภาษี (ใต้นั้นเป็นส่วนปันส่วน/ทดเลข) */
function statementRows(ws: ExcelJS.Worksheet) {
  const accounts: AccountRow[] = [];
  const totals = new Map<TotalKey, number>();
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    const group = text(ws, r, 1);
    if (group) {
      accounts.push({ row: r, group, label: text(ws, r, 2) });
      continue;
    }
    const label = squash(text(ws, r, 2));
    const hit = CHECKED_TOTALS.find(([key, prefix]) => !totals.has(key) && label.startsWith(prefix));
    if (hit) totals.set(hit[0], r);
    if (totals.has("PBT")) break;
  }
  const missing = CHECKED_TOTALS.filter(([key]) => !totals.has(key));
  if (missing.length) {
    throw new ImportError(`ชีต "${ws.name}": ไม่พบแถวยอดรวม ${missing.map(([, l]) => `"${l}"`).join(", ")} ในคอลัมน์ B`);
  }
  return { accounts, totals };
}

/** ชีตร่าง = คอลัมน์รวม (C) ไม่มีตัวเลขที่ไม่ใช่ 0 เลย (ช่อง error ในชีตร่างไม่นับ) */
function isDraftSheet(ws: ExcelJS.Worksheet): boolean {
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    try {
      if (amount(ws, r, FIRST_UNIT_COL) !== 0) return false;
    } catch {
      // ข้ามช่อง error/ข้อความ
    }
  }
  return true;
}

type Ctx = {
  regions: Map<string, ExcelJS.Worksheet>;
  skippedNames: Set<string>;
  sheetNames: Set<string>;
  /** Group ใหม่ที่ผู้ดูแลเลือกหมวดแล้ว + Group ที่นับในงบทั้งหมด */
  extra: ExtraGroup[];
  known: Set<string>;
  unknown: Map<string, { name: string; amount: number }>;
  detected: Map<string, DetectedUnit>;
};

/** อ่านงบของเดือนเดียว: ชีตงบรวม + ชีตภูมิภาคที่งบรวมอ้างถึงในแถว 1 */
function parseMonth(master: ExcelJS.Worksheet, month: number, ctx: Ctx) {
  const units = new Map<string, GroupAmounts>();
  const mismatches: Mismatch[] = [];
  const usedRegions = new Set<string>();
  let rowCount = 0;

  /** อ่านยอดราย Group ของคอลัมน์หน่วยล่างสุด · หน่วยนอกผังในโค้ดที่มียอด = หน่วยใหม่ที่ตรวจพบ */
  const readLeaf = (ws: ExcelJS.Worksheet, accounts: AccountRow[], uc: UnitColumn) => {
    if (!uc.code) throw new ImportError(`ชีต "${ws.name}" ช่อง ${ws.getCell(1, uc.col).address}: หน่วย "${uc.name}" ไม่มีรหัสในแถว 1`);
    if (units.has(uc.code)) throw new ImportError(`ชีต "${ws.name}": รหัสหน่วย "${uc.code}" ซ้ำกับหน่วยอื่นในเดือน ${thaiMonth(month)} (${uc.name})`);
    const g: GroupAmounts = {};
    for (const { row, group, label } of accounts) {
      const v = amount(ws, row, uc.col);
      if (v === 0) continue;
      rowCount++;
      // Group ใหม่: เก็บยอดไว้ด้วย (นับในงบเมื่อผู้ดูแลเลือกหมวดแล้ว ไม่ต้องนำเข้าไฟล์ซ้ำ)
      if (!ctx.known.has(group)) {
        const u = ctx.unknown.get(group);
        ctx.unknown.set(group, { name: u?.name || label || group, amount: (u?.amount ?? 0) + v });
      }
      g[group] = (g[group] ?? 0) + v;
    }
    units.set(uc.code, normalizeGroups(g));
    if (!IMPORT_UNIT_CODES.has(uc.code) && Object.keys(g).length) {
      ctx.detected.set(uc.code, { code: uc.code, name: stripNumbering(uc.name), sheet: ws.name, zoneCode: zoneOfSheet(ws.name) });
    }
  };

  /** เทียบยอดรวมที่คำนวณจากหน่วยล่างสุดของชีต กับคอลัมน์รวม (C) ในไฟล์ */
  const check = (ws: ExcelJS.Worksheet, totals: Map<TotalKey, number>, code: string, leaves: string[]) => {
    const sum: GroupAmounts = {};
    for (const leaf of leaves) for (const [g, v] of Object.entries(units.get(leaf) ?? {})) sum[g] = (sum[g] ?? 0) + v;
    const computed = computeTotals(sum, ctx.extra);
    for (const [key, row] of totals) {
      const file = amount(ws, row, FIRST_UNIT_COL);
      if (Math.abs(file - computed[key]) > 0.01) {
        mismatches.push({ month, sheet: ws.name, unitCode: code, key, file, computed: computed[key], leaves });
      }
    }
  };

  const masterRows = statementRows(master);
  const rootCode = text(master, 1, FIRST_UNIT_COL);
  for (const uc of unitColumns(master)) {
    const ref = regionRef(master, uc, month, ctx.sheetNames);
    if (ref && ctx.skippedNames.has(ref)) {
      throw new ImportError(`ชีต "${ref}" ถูกอ้างจากงบรวม "${master.name}" แต่สีแท็บไม่ใช่ ${STATEMENT_SHEET_COLOR} — ตั้งสีแท็บให้เป็น ${STATEMENT_SHEET_COLOR}`);
    }
    const region = ref ? ctx.regions.get(ref) : undefined;
    if (!region) {
      readLeaf(master, masterRows.accounts, uc);
      continue;
    }
    // คอลัมน์ที่อ้างถึงชีตภูมิภาคอาจมีหลายคอลัมน์ต่อชีต (สำนักงาน + สาขา) — อ่านจากชีตภูมิภาคครั้งเดียว
    if (usedRegions.has(region.name)) continue;
    usedRegions.add(region.name);

    const rows = statementRows(region);
    const regionCode = text(region, 1, FIRST_UNIT_COL) || region.name;
    const leaves: string[] = [];
    for (const leaf of unitColumns(region)) {
      // คอลัมน์ยอดรวมย่อย (เช่น "รวมสาขาน่าน") เป็นผลรวมของคอลัมน์อื่น ไม่ใช่หน่วย
      if (leaf.name.startsWith("รวม")) continue;
      readLeaf(region, rows.accounts, leaf);
      leaves.push(leaf.code);
    }
    check(region, rows.totals, regionCode, leaves);
  }
  check(master, masterRows.totals, rootCode || master.name, [...units.keys()]);
  // หน่วยนอกผังที่ไม่มียอดเลยไม่ต้องเก็บ
  return { units: new Map([...units].filter(([code]) => IMPORT_UNIT_CODES.has(code) || ctx.detected.has(code))), mismatches, usedRegions, rowCount };
}

/**
 * อ่านไฟล์ Master: เฉพาะชีตสีแท็บ STATEMENT_SHEET_COLOR ที่ชื่อเป็นเดือนและ A1 เป็น "MASTER_"
 * เดือนที่ยังเป็นชีตร่าง (ไม่มีตัวเลข) จะถูกข้าม · extra = Group ใหม่ที่ผู้ดูแลเลือกหมวดแล้ว (นับในการตรวจยอดรวม)
 */
export async function parseStatementWorkbook(data: ArrayBuffer | Buffer, extra: ExtraGroup[] = []): Promise<ParsedStatement> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(data as ArrayBuffer);

  const palette = workbookPalette(book);
  const skippedNames = new Set<string>();
  const masters: { ws: ExcelJS.Worksheet; month: number }[] = [];
  const regions = new Map<string, ExcelJS.Worksheet>();
  for (const ws of book.worksheets) {
    const sm = sheetMonth(ws.name);
    if (tabColorOf(ws, palette) !== STATEMENT_SHEET_COLOR || !sm || text(ws, 1, 1) !== SHEET_MARK) {
      skippedNames.add(ws.name);
      continue;
    }
    if (sm.prefix === null) masters.push({ ws, month: sm.month });
    else regions.set(ws.name, ws);
  }
  if (masters.length === 0) {
    throw new ImportError(
      `ไม่พบชีตงบรวมรายเดือน — ต้องเป็นชีตสีแท็บ ${STATEMENT_SHEET_COLOR} ชื่อเป็นตัวย่อเดือน (เช่น "ม.ค.") และช่อง A1 เป็น "${SHEET_MARK}"`,
    );
  }
  const dup = masters.find((s, i) => masters.findIndex((x) => x.month === s.month) !== i);
  if (dup) throw new ImportError(`มีชีตงบรวมของเดือน ${thaiMonth(dup.month)} มากกว่า 1 ชีต`);

  const ctx: Ctx = {
    regions,
    skippedNames,
    sheetNames: new Set(book.worksheets.map((ws) => ws.name)),
    extra,
    known: knownGroups(extra),
    unknown: new Map(),
    detected: new Map(),
  };
  const usedRegions = new Set<string>();
  const months: ParsedMaster["months"] = [];
  const emptyMonths: number[] = [];
  const mismatches: Mismatch[] = [];
  let rowCount = 0;

  for (const { ws, month } of masters.sort((a, b) => a.month - b.month)) {
    if (isDraftSheet(ws)) {
      emptyMonths.push(month);
      // ชีตภูมิภาคของเดือนร่างก็นับว่าถูกอ้างถึงแล้ว
      for (const uc of unitColumns(ws)) {
        const ref = regionRef(ws, uc, month, ctx.sheetNames);
        if (ref) usedRegions.add(ref);
      }
      continue;
    }
    const result = parseMonth(ws, month, ctx);
    months.push({ month, units: result.units });
    mismatches.push(...result.mismatches);
    rowCount += result.rowCount;
    for (const name of result.usedRegions) usedRegions.add(name);
  }

  if (months.length === 0) {
    throw new ImportError(
      `ไฟล์นี้ยังไม่มีข้อมูลเดือนใดเลย — ชีตงบรวมสี ${STATEMENT_SHEET_COLOR} ทุกเดือนเป็น 0 ทั้งหมด (ถ้าไฟล์มีข้อมูลจริง ให้เปิดใน Excel ให้คำนวณสูตรเสร็จแล้วบันทึกใหม่)`,
    );
  }
  const unusedRegion = [...regions.keys()].find((name) => !usedRegions.has(name));
  if (unusedRegion) throw new ImportError(`ชีต "${unusedRegion}" ไม่ถูกอ้างถึงจากชีตงบรวมของเดือนเดียวกัน (แถว 1)`);
  const { areas, issues: areaIssues } = parseBranchAreas(book);

  return {
    areas,
    areaIssues,
    monthy: parseMonthySheet(book, extra),
    months,
    rowCount,
    emptyMonths,
    unknownGroups: [...ctx.unknown].map(([group, u]) => ({ group, ...u })),
    mismatches,
    newUnits: [...ctx.detected.values()],
    missingUnits: [...IMPORT_UNIT_CODES].filter((code) => !months.some((m) => m.units.has(code))),
  };
}
