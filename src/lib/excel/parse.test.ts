import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { computeStatement } from "../statement";
import { parseWorkbook, thaiMonthToNumber, type ParsedWorkbook } from "./parse";

const DATA_FILE = path.resolve(__dirname, "../../../Data.xlsx");

describe("thaiMonthToNumber", () => {
  it("แปลงชื่อเดือนไทยย่อเป็นเลขเดือน", () => {
    expect(thaiMonthToNumber("ม.ค.")).toBe(1);
    expect(thaiMonthToNumber(" ธ.ค. ")).toBe(12);
    expect(thaiMonthToNumber("Jan")).toBeNull();
  });
});

describe.skipIf(!existsSync(DATA_FILE))("parseWorkbook กับ Data.xlsx", () => {
  let wb: ParsedWorkbook;
  beforeAll(async () => {
    wb = await parseWorkbook(readFileSync(DATA_FILE));
  });

  const unit = (code: string) => wb.units.find((u) => u.code === code);
  const sumFacts = (account: string, filter: (unitCode: string) => boolean = () => true) =>
    wb.facts.filter((f) => f.accountCode === account && filter(f.unitCode)).reduce((s, f) => s + Number(f.amount), 0);

  it("อ่านเดือนจากชีตงบรวม", () => {
    expect(wb.month).toBe(1);
  });

  it("สร้างลำดับชั้น บริษัท → ภูมิภาค/หน่วย → สาขา", () => {
    expect(wb.units).toHaveLength(90);
    expect(unit("MSP")).toMatchObject({ parentCode: null, level: 0 });
    for (const region of ["CMI-SHOP", "NAN", "SU"]) expect(unit(region)).toMatchObject({ parentCode: "MSP", level: 1 });
    expect(unit("CM-HO")).toMatchObject({ parentCode: "MSP", level: 1 });
    expect(unit("CM-101")).toMatchObject({ parentCode: "CMI-SHOP", level: 2, name: "สันป่าตอง" });
    expect(unit("SU-HO")).toMatchObject({ parentCode: "SU", name: "ออฟฟิศสุโขทัย" });
    expect(unit("NAN-411")?.name).toBe("MP ท่าวังผา");
    expect(unit("SU-513")?.name).toBe("บางระกำ");
  });

  it("ไม่นำคอลัมน์ยอดรวมย่อย (รวม...) มาเป็นหน่วย", () => {
    expect(unit("รวม")).toBeUndefined();
    expect(wb.units.filter((u) => u.code === "SU-HO")).toHaveLength(1);
  });

  it("เรียงหน่วยตามคอลัมน์ในงบรวม", () => {
    const level1 = wb.units.filter((u) => u.level === 1).sort((a, b) => a.sortOrder - b.sortOrder).map((u) => u.code);
    expect(level1.slice(0, 4)).toEqual(["CM-HO", "CMI-SHOP", "NAN", "SU"]);
  });

  it("เก็บข้อมูลเฉพาะหน่วยล่างสุด ปัดเป็น 2 ตำแหน่ง และไม่เก็บค่า 0", () => {
    const leafCodes = new Set(wb.units.filter((u) => !wb.units.some((c) => c.parentCode === u.code)).map((u) => u.code));
    expect(leafCodes.size).toBe(86);
    expect(wb.facts.every((f) => leafCodes.has(f.unitCode))).toBe(true);
    expect(wb.facts.every((f) => Number(f.amount) !== 0 && /^-?\d+\.\d{2}$/.test(f.amount))).toBe(true);
    expect(wb.facts.find((f) => f.unitCode === "CM-101" && f.accountCode === "A")?.amount).toBe("5364076.21");
  });

  it("ผลรวมของหน่วยล่างสุดตรงกับยอดรวมในไฟล์", () => {
    expect(wb.mismatches).toEqual([]);
    expect(sumFacts("A")).toBeCloseTo(358841695.81, 2);
  });

  it("นำเข้าแถวปันส่วน HQ", () => {
    // ปัดทีละหน่วย จึงคลาดจากยอดในไฟล์ได้ระดับสตางค์
    expect(sumFacts("HQ-EXP", (u) => u.startsWith("NAN"))).toBeCloseTo(-15576.6, 1);
    expect(sumFacts("HQ-COGS", (u) => u.startsWith("SU"))).toBeCloseTo(-21243.1, 1);
  });

  it("ยอดรวมทั้งบริษัทที่คำนวณได้ตรงกับงบในไฟล์", () => {
    const amounts: Record<string, number> = {};
    for (const f of wb.facts) amounts[f.accountCode] = (amounts[f.accountCode] ?? 0) + Number(f.amount);
    const { totals } = computeStatement(amounts);
    expect(totals.REV).toBeCloseTo(361556532.08, 1);
    expect(totals.COGS).toBeCloseTo(293554576.61, 1);
    expect(totals.GP).toBeCloseTo(68001955.47, 1);
    expect(totals.SGA).toBeCloseTo(46964146.93, 1);
    expect(totals.OP).toBeCloseTo(21037808.54, 1);
    expect(totals.PBT).toBeCloseTo(17217467.63, 1);
  });
});

async function buildWorkbook(rows: unknown[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet("ม.ค.");
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe("parseWorkbook กับไฟล์ที่รูปแบบผิด", () => {
  it("แจ้งรหัสบัญชีที่ระบบไม่รู้จัก", async () => {
    const buf = await buildWorkbook([
      ["MASTER_", "ม.ค.", "MSP", null, null, "X-1"],
      ["Group", "รายการ", "รวมทั้งหมด", "%", null, "1.หน่วย"],
      ["QQ", "บัญชีใหม่", 10, 100, null, 10],
    ]);
    await expect(parseWorkbook(buf)).rejects.toThrow(/QQ/);
  });

  it("แจ้งเมื่อไม่พบชีตงบรวม", async () => {
    const buf = await buildWorkbook([["อะไรก็ได้"]]);
    await expect(parseWorkbook(buf)).rejects.toThrow(/งบรวม/);
  });

  it("แจ้งเมื่อรหัสหน่วยซ้ำ", async () => {
    const buf = await buildWorkbook([
      ["MASTER_", "ม.ค.", "MSP", null, null, "X-1", null, null, "X-1"],
      ["Group", "รายการ", "รวมทั้งหมด", "%", null, "1.ก", "%", null, "2.ข"],
      ["A", "รายได้จากการขาย", 30, 100, null, 10, 100, null, 20],
    ]);
    await expect(parseWorkbook(buf)).rejects.toThrow(/X-1/);
  });
});
