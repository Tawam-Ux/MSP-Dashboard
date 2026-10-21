import type ExcelJS from "exceljs";
import type { TotalKey } from "../statement";
import { computeTotals, normalizeGroups, type ExtraGroup, type GroupAmounts } from "./compute";
import { CHECKED_TOTALS, amount, sheetMonth, squash, text } from "./parse";

// ชีต "Monthy" (ชื่อในไฟล์สะกดแบบนี้) = ภาพรวมรายเดือนของทั้งบริษัท — ต้นทางของหน้า Overview
// แถว 1 = หัวคอลัมน์: Group | รายการ | ม.ค. | % | (ว่าง) | ก.พ. | ... | ธ.ค. | ... | รวมทั้งหมด (เดือนละ 3 คอลัมน์)
// แถวถัดมา = Group/บรรทัดชุดเดียวกับชีตงบ (คอลัมน์ A = Group, B = รายการ) · แถวยอดรวมไม่มี Group ในคอลัมน์ A
// ยอดแต่ละช่องเป็นสูตร VLOOKUP คอลัมน์รวม (C) ของชีตเดือนนั้น — อ่านผลที่ Excel คำนวณเก็บไว้ ยอดรวมคิดเองด้วย Flow เดียวกับชีตงบ

/** ชื่อชีตที่อ่าน (เทียบแบบไม่สนตัวพิมพ์และช่องว่าง) — สะกดถูก "Monthly" ก็รับ */
export const MONTHY_SHEETS = ["monthy", "monthly"];

export type MonthyMonth = {
  month: number;
  /** ยอดราย Group ทั้งบริษัท (ปรับเครื่องหมาย XW/XY แล้ว) */
  groups: GroupAmounts;
};

/** ยอดรวมที่ระบบคำนวณจากยอดราย Group ไม่ตรงกับแถวยอดรวมในชีต Monthy */
export type MonthyMismatch = { month: number; key: TotalKey; file: number; computed: number };

export type ParsedMonthy = {
  sheet: string;
  /** เฉพาะเดือนที่มีตัวเลข เรียง ม.ค. → ธ.ค. */
  months: MonthyMonth[];
  /** เดือนที่มีคอลัมน์แต่ยอดเป็น 0 ทั้งหมด (ยังไม่ปิดงบ) */
  emptyMonths: number[];
  mismatches: MonthyMismatch[];
  /** ช่องที่อ่านไม่ได้ (สูตร error / ไม่ใช่ตัวเลข) — นับเป็น 0 */
  issues: string[];
};

/** อ่านชีต Monthy · ไม่มีชีตนี้ = null (นำเข้าได้ตามปกติ หน้า Overview ใช้ข้อมูลชุดเดิมของปีนั้น) */
export function parseMonthySheet(book: ExcelJS.Workbook, extra: ExtraGroup[] = []): ParsedMonthy | null {
  const ws = book.worksheets.find((w) => MONTHY_SHEETS.includes(squash(w.name).toLowerCase()));
  if (!ws) return null;

  // คอลัมน์เดือนหาจากหัวคอลัมน์แถว 1 (ไม่ยึดตำแหน่ง) · ชื่อเดือนซ้ำใช้คอลัมน์แรก
  const monthCols = new Map<number, number>();
  for (let col = 1; col <= ws.columnCount; col++) {
    const m = sheetMonth(text(ws, 1, col));
    if (m && m.prefix === null && !monthCols.has(m.month)) monthCols.set(m.month, col);
  }

  const issues: string[] = [];
  const read = (row: number, col: number) => {
    try {
      return amount(ws, row, col);
    } catch (e) {
      issues.push(e instanceof Error ? e.message : String(e));
      return 0;
    }
  };

  // แถวบัญชี (มี Group) และแถวยอดรวมที่ใช้ตรวจ — อ่านถึงแถวกำไรก่อนภาษีแถวแรก (ใต้นั้นเป็นส่วนปันส่วน HQ)
  const accounts: { row: number; group: string }[] = [];
  const totalRows = new Map<TotalKey, number>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const group = text(ws, r, 1);
    if (group) {
      accounts.push({ row: r, group });
      continue;
    }
    const label = squash(text(ws, r, 2));
    const hit = CHECKED_TOTALS.find(([key, prefix]) => !totalRows.has(key) && label.startsWith(prefix));
    if (hit) totalRows.set(hit[0], r);
    if (totalRows.has("PBT")) break;
  }

  const months: MonthyMonth[] = [];
  const emptyMonths: number[] = [];
  const mismatches: MonthyMismatch[] = [];
  for (const [month, col] of [...monthCols].sort(([a], [b]) => a - b)) {
    const g: GroupAmounts = {};
    for (const { row, group } of accounts) {
      const v = read(row, col);
      if (v !== 0) g[group] = (g[group] ?? 0) + v;
    }
    if (Object.keys(g).length === 0) {
      emptyMonths.push(month);
      continue;
    }
    const groups = normalizeGroups(g);
    const computed = computeTotals(groups, extra);
    for (const [key, row] of totalRows) {
      const file = read(row, col);
      if (Math.abs(file - computed[key]) > 0.01) mismatches.push({ month, key, file, computed: computed[key] });
    }
    months.push({ month, groups });
  }
  return { sheet: ws.name, months, emptyMonths, mismatches, issues };
}
