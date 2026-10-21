import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseMonthySheet } from "./monthy";

// จำลองชีต Monthy ตามไฟล์จริง: แถว 1 หัวคอลัมน์ (เดือนละ 3 คอลัมน์เริ่มที่ C), A = Group, B = รายการ
const f = (formula: string, result?: unknown) => (result === undefined ? { formula } : { formula, result });

type Month = { a: number; n: number; xy?: number; rev?: number };

function monthy(months: (Month | null)[], name = "Monthy"): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  const heads = ["ม.ค.", "ก.พ.", "มี.ค."];
  const row = (first: unknown[], pick: (m: Month | null) => unknown) => {
    const r = [...first];
    for (const m of months) r.push(pick(m), null, null);
    return r;
  };
  // XY อยู่ในต้นทุนขายและติดลบเสมอ → กำไรขั้นต้น = รายได้ + |XY|
  const gp = (m: Month) => m.a + Math.abs(m.xy ?? 0);
  const rows = [
    ["Group", "รายการ", ...months.flatMap((_, i) => [heads[i], "%", null]), "รวมทั้งหมด"],
    // สูตรที่ผลเป็น 0 — exceljs ไม่เก็บผล (นับเป็น 0)
    row(["A", "รายได้จากการขาย"], (m) => (m ? m.a : f("IFERROR(VLOOKUP($A2,INDIRECT(C$1&\"!$A:$C\"),3,0),0)"))),
    row(["B", "รายได้จากการขาย-อาหาร"], () => f("VLOOKUP()")),
    row([null, "รายได้รวม"], (m) => (m ? (m.rev ?? m.a) : f("SUM(C2:C3)"))),
    row(["XY", "    บัญชีพักต้นทุน"], (m) => m?.xy ?? 0),
    row([null, "กำไรขั้นต้น  (Gross Profit)"], (m) => (m ? gp(m) : 0)),
    row(["N", "ค่าใช้จ่ายในการเดินทาง"], (m) => m?.n ?? 0),
    row([null, "กำไร(ขาดทุน) จากการดำเนนงาน"], (m) => (m ? gp(m) - m.n : 0)),
    row([null, "กำไร(ขาดทุน) ก่อนภาษี"], (m) => (m ? gp(m) - m.n : 0)),
    row([null, "รายได้ปันส่วน HQ"], () => 999),
    row([null, "กำไร(ขาดทุน) ก่อนภาษี"], () => 123),
  ];
  rows.forEach((r) => ws.addRow(r));
  return wb;
}

describe("parseMonthySheet", () => {
  it("ไม่มีชีต = null", () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Overview");
    expect(parseMonthySheet(wb)).toBeNull();
  });

  it("อ่านยอดราย Group รายเดือน · ข้ามเดือนที่ยังเป็น 0 · ยอดรวมตรงกับชีต", () => {
    const parsed = parseMonthySheet(monthy([{ a: 100, n: 10 }, { a: 80, n: 30, xy: 5 }, null]))!;
    expect(parsed.sheet).toBe("Monthy");
    expect(parsed.months).toEqual([
      { month: 1, groups: { A: 100, N: 10 } },
      // XY ติดลบเสมอ (เหมือนชีตงบ)
      { month: 2, groups: { A: 80, N: 30, XY: -5 } },
    ]);
    expect(parsed.emptyMonths).toEqual([3]);
    expect(parsed.mismatches).toEqual([]);
    expect(parsed.issues).toEqual([]);
  });

  it("แถวยอดรวมในชีตไม่ตรงกับผลรวมราย Group = mismatch", () => {
    const parsed = parseMonthySheet(monthy([{ a: 100, n: 10, rev: 150 }]))!;
    expect(parsed.mismatches).toEqual([{ month: 1, key: "REV", file: 150, computed: 100 }]);
  });

  it("รับชื่อชีตสะกด Monthly", () => {
    expect(parseMonthySheet(monthy([{ a: 1, n: 0 }], "Monthly"))?.months).toHaveLength(1);
  });
});
