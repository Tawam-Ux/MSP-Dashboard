import ExcelJS from "exceljs";
import { ACCOUNT_CODES } from "../statement";

// รูปแบบไฟล์ (ดู docs/spec.md):
// แถว 1 = รหัสหน่วย, แถว 2 = ชื่อหน่วย, ทุกหน่วยใช้ 3 คอลัมน์ (ยอดเงิน, %, ว่าง)
// คอลัมน์ C = ยอดรวมของชีต, คอลัมน์ A = รหัสบัญชี

export type ParsedUnit = { code: string; name: string; parentCode: string | null; level: number; sortOrder: number };
export type ParsedFact = { unitCode: string; accountCode: string; amount: string };
export type Mismatch = { sheet: string; accountCode: string; fileTotal: number; sumOfUnits: number };
export type ParsedWorkbook = { month: number; units: ParsedUnit[]; facts: ParsedFact[]; mismatches: Mismatch[] };

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thaiMonthToNumber(text: string): number | null {
  const i = THAI_MONTHS.indexOf(text.trim());
  return i === -1 ? null : i + 1;
}

const FIRST_UNIT_COL = 3;
const COLS_PER_UNIT = 3;
const FIRST_DATA_ROW = 3;

// แถวปันส่วน HQ ไม่มีรหัสบัญชีในไฟล์ จึงจับคู่จากชื่อรายการ
const ALLOCATION_START = "รายได้ปันส่วน HQ";
const ALLOCATION_LABELS: Record<string, string> = {
  "รายได้ปันส่วน HQ": "HQ-REV",
  "ต้นทุนขาย": "HQ-COGS",
  "ค่าใช้จ่ายปันส่วน HQ": "HQ-EXP",
};

class ImportError extends Error {}

function text(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const v = ws.getCell(row, col).value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}

function num(ws: ExcelJS.Worksheet, row: number, col: number): number {
  const v = ws.getCell(row, col).value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  return 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const stripNumbering = (name: string) => name.replace(/^\d+\s*\.?\s*/, "").trim() || name;
const isSubtotal = (name: string) => name.startsWith("รวม");

type UnitColumn = { col: number; code: string; name: string };

function unitColumns(ws: ExcelJS.Worksheet): UnitColumn[] {
  const out: UnitColumn[] = [];
  for (let col = FIRST_UNIT_COL + COLS_PER_UNIT; col <= ws.columnCount; col += COLS_PER_UNIT) {
    const name = text(ws, 2, col);
    if (!name || name === "%") continue;
    out.push({ col, code: text(ws, 1, col), name });
  }
  return out;
}

/** แถวข้อมูล: เลขแถว → รหัสบัญชี (ข้ามแถวยอดรวมที่ไม่มีรหัส) */
function accountRows(ws: ExcelJS.Worksheet): Map<number, string> {
  const rows = new Map<number, string>();
  let inAllocation = false;
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    const code = text(ws, r, 1);
    const label = text(ws, r, 2);
    if (label === ALLOCATION_START) inAllocation = true;
    if (code) {
      if (!ACCOUNT_CODES.has(code)) {
        throw new ImportError(`ชีต "${ws.name}" แถว ${r}: ไม่รู้จักรหัสบัญชี "${code}" (${label}) — ต้องเพิ่มในโครงสร้างงบก่อนนำเข้า`);
      }
      rows.set(r, code);
    } else if (inAllocation && ALLOCATION_LABELS[label] && !Array.from(rows.values()).includes(ALLOCATION_LABELS[label])) {
      rows.set(r, ALLOCATION_LABELS[label]);
    }
  }
  return rows;
}

export async function parseWorkbook(data: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(data as ArrayBuffer);

  const sheets = book.worksheets.filter((ws) => text(ws, 1, 1) === "MASTER_");
  const master = sheets.find((ws) => !ws.name.includes("_"));
  if (!master) throw new ImportError('ไม่พบชีตงบรวม (ชีตที่ช่อง A1 เป็น "MASTER_" และชื่อชีตไม่มี "_")');

  const month = thaiMonthToNumber(text(master, 1, 2));
  if (!month) throw new ImportError(`ชีต "${master.name}": ช่อง B1 ต้องเป็นชื่อเดือนไทยย่อ เช่น ม.ค. (พบ "${text(master, 1, 2)}")`);

  const regionSheets = new Map(sheets.filter((ws) => ws !== master).map((ws) => [ws.name, ws]));
  const units: ParsedUnit[] = [];
  const facts: ParsedFact[] = [];
  const mismatches: Mismatch[] = [];
  let sortOrder = 0;

  const addUnit = (u: Omit<ParsedUnit, "sortOrder">) => {
    if (!u.code) throw new ImportError(`หน่วย "${u.name}" ไม่มีรหัสในแถว 1`);
    if (units.some((x) => x.code === u.code)) throw new ImportError(`รหัสหน่วย "${u.code}" ซ้ำกัน (${u.name})`);
    units.push({ ...u, sortOrder: sortOrder++ });
  };

  const addFacts = (ws: ExcelJS.Worksheet, rows: Map<number, string>, col: number, unitCode: string) => {
    for (const [r, accountCode] of rows) {
      const amount = round2(num(ws, r, col));
      if (amount !== 0) facts.push({ unitCode, accountCode, amount: amount.toFixed(2) });
    }
  };

  /** เทียบยอดรวมในคอลัมน์ C กับผลรวมของหน่วยล่างสุดในชีต */
  const check = (ws: ExcelJS.Worksheet, rows: Map<number, string>, leafCodes: Set<string>, skip: (code: string) => boolean) => {
    // ปัดทีละหน่วยคลาดได้ไม่เกินครึ่งสตางค์ต่อหน่วย
    const tolerance = 0.005 * leafCodes.size + 0.005;
    for (const [r, accountCode] of rows) {
      if (skip(accountCode)) continue;
      const fileTotal = round2(num(ws, r, FIRST_UNIT_COL));
      const sumOfUnits = round2(
        facts.filter((f) => f.accountCode === accountCode && leafCodes.has(f.unitCode)).reduce((s, f) => s + Number(f.amount), 0),
      );
      if (Math.abs(fileTotal - sumOfUnits) > tolerance) mismatches.push({ sheet: ws.name, accountCode, fileTotal, sumOfUnits });
    }
  };

  const rootCode = text(master, 1, FIRST_UNIT_COL);
  addUnit({ code: rootCode, name: `${rootCode} ${text(master, 2, FIRST_UNIT_COL)}`, parentCode: null, level: 0 });

  const masterRows = accountRows(master);
  const usedRegions = new Set<string>();

  for (const uc of unitColumns(master)) {
    const region = regionSheets.get(uc.code);
    if (!region) {
      addUnit({ code: uc.code, name: stripNumbering(uc.name), parentCode: rootCode, level: 1 });
      addFacts(master, masterRows, uc.col, uc.code);
      continue;
    }
    // คอลัมน์ที่อ้างถึงชีตภูมิภาค อาจมีหลายคอลัมน์ต่อชีต (สำนักงาน + สาขา) ใช้ข้อมูลจากชีตภูมิภาคครั้งเดียว
    if (usedRegions.has(region.name)) continue;
    usedRegions.add(region.name);

    const regionCode = text(region, 1, FIRST_UNIT_COL);
    const regionName = text(region, 2, FIRST_UNIT_COL).replace(/^รวม/, "").trim();
    addUnit({ code: regionCode, name: regionName, parentCode: rootCode, level: 1 });

    const rows = accountRows(region);
    const leaves = new Set<string>();
    for (const leaf of unitColumns(region)) {
      if (isSubtotal(leaf.name)) continue;
      addUnit({ code: leaf.code, name: stripNumbering(leaf.name), parentCode: regionCode, level: 2 });
      addFacts(region, rows, leaf.col, leaf.code);
      leaves.add(leaf.code);
    }
    check(region, rows, leaves, () => false);
  }

  const unusedRegion = [...regionSheets.keys()].find((name) => !usedRegions.has(name));
  if (unusedRegion) throw new ImportError(`ชีต "${unusedRegion}" ไม่ถูกอ้างถึงจากงบรวม (แถว 1 ของชีต "${master.name}")`);

  // งบรวมไม่มีข้อมูลปันส่วน HQ จึงไม่ตรวจแถวเหล่านั้นในระดับบริษัท
  const allLeaves = new Set(units.filter((u) => !units.some((c) => c.parentCode === u.code)).map((u) => u.code));
  check(master, masterRows, allLeaves, (code) => code.startsWith("HQ-"));

  return { month, units, facts, mismatches };
}

export { ImportError };
