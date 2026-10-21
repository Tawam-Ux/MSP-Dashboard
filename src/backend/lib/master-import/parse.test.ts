import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ImportError, parseBranchAreas, parseStatementWorkbook, sheetMonth } from "./parse";
import { applyTint, themePalette } from "./tab-color";

// จำลองชีตงบตามไฟล์จริง: แถว 1 รหัสหน่วย, แถว 2 ชื่อหน่วย, หน่วยละ 3 คอลัมน์เริ่มที่ C, A = Group, B = รายการ
type Col = { code: string | { formula: string; result?: unknown }; name: string; a: number; n?: number };

const f = (formula: string, result?: unknown) => (result === undefined ? { formula } : { formula, result });

/** ชีตงบที่มีแค่ A (รายได้) และ N (ค่าใช้จ่าย) — คอลัมน์แรกคือคอลัมน์รวมของชีต */
function statement(month: string, cols: Col[]): unknown[][] {
  const row = (first: unknown[], pick: (c: Col) => unknown) => {
    const r = [...first];
    for (const c of cols) r.push(pick(c), null, null);
    return r;
  };
  const rev = (c: Col) => c.a;
  const op = (c: Col) => c.a - (c.n ?? 0);
  return [
    row([f('"MASTER_"', "MASTER_"), month], (c) => c.code),
    row(["Group", "รายการ"], (c) => c.name),
    row(["A", "รายได้จากการขาย"], (c) => c.a),
    row([null, "รายได้รวม"], rev),
    row([null, "กำไรขั้นต้น  (Gross Profit)"], rev),
    row(["N", "ค่าใช้จ่ายในการเดินทาง"], (c) => c.n ?? f("I3")),
    row([null, "กำไร(ขาดทุน) จากการดำเนนงาน"], op),
    row([null, "กำไร(ขาดทุน) ก่อนภาษี"], op),
    row([null, "รายได้ปันส่วน HQ"], () => f("1/0", { error: "#DIV/0!" })),
  ];
}

async function book(sheets: { name: string; rows: unknown[][]; argb?: string }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { properties: { tabColor: { argb: s.argb ?? "FF002060" } } });
    s.rows.forEach((r) => ws.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const region = (month = "ม.ค.", hq = 30) =>
  statement(month, [
    { code: "NAN", name: "รวมน่าน", a: hq + 20 + 30, n: 5 },
    { code: "NAN-HO", name: "1.ออฟฟิศน่าน", a: hq },
    { code: "รวม", name: "รวมสาขาน่าน", a: 50, n: 5 },
    { code: "NAN-402", name: "2.ตั้งจิตอนุสรณ์", a: 20, n: 5 },
    { code: "NAN-403", name: "3.เวียงสา", a: 30 },
  ]);

const master = (month = "ม.ค.", total = 180) =>
  statement(month, [
    { code: "MSP", name: "รวมทั้งหมด", a: total, n: 5 },
    { code: "CM-HO", name: "1.สำนักงานใหญ่", a: 100 },
    { code: f('"น่าน_"&$B$1', `น่าน_${month}`), name: "3.สำนักงานน่าน", a: 30 },
    { code: f('"น่าน_"&$B$1', `น่าน_${month}`), name: "4.สาขาน่าน", a: 50, n: 5 },
  ]);

describe("sheetMonth", () => {
  it("อ่านเดือนจากชื่อชีต", () => {
    expect(sheetMonth("ม.ค.")).toEqual({ month: 1, prefix: null });
    expect(sheetMonth("เชียงใหม่_ส.ค.")).toEqual({ month: 8, prefix: "เชียงใหม่" });
    expect(sheetMonth("MASTER_ม.ค.")).toEqual({ month: 1, prefix: "MASTER" });
    expect(sheetMonth("สรุปรายเดือน")).toBeNull();
  });
});

describe("สีแท็บ", () => {
  it("แปลงสีธีม + tint แบบ Excel", () => {
    expect(applyTint("4472C4", -0.499984740745262)).toBe("203764");
    expect(themePalette(undefined)[4]).toBe("4472C4");
  });
});

describe("parseStatementWorkbook", () => {
  it("อ่านเฉพาะชีตสี #002060 · ยอดราย Group ของหน่วยล่างสุด · ข้ามคอลัมน์รวมและคอลัมน์ที่อ้างชีตภูมิภาค", async () => {
    const parsed = await parseStatementWorkbook(
      await book([
        { name: "MASTER_ม.ค.", rows: [["Group", "โซน", "สาขา"]], argb: "FFC00000" },
        { name: "ม.ค.", rows: master() },
        { name: "น่าน_ม.ค.", rows: region() },
      ]),
    );
    expect(parsed.months.map((m) => m.month)).toEqual([1]);
    const units = parsed.months[0].units;
    expect([...units.keys()].sort()).toEqual(["CM-HO", "NAN-402", "NAN-403", "NAN-HO"]);
    expect(units.get("NAN-402")).toEqual({ A: 20, N: 5 });
    // สูตรที่ไม่มีผล = 0 ไม่ถูกเก็บ
    expect(units.get("NAN-403")).toEqual({ A: 30 });
    expect(parsed.mismatches).toEqual([]);
    expect(parsed.newUnits).toEqual([]);
    expect(parsed.missingUnits).toContain("CM-101");
  });

  it("หน่วยนอกผังในโค้ด = หน่วยใหม่ที่ตรวจพบ: เก็บยอดไว้ และเดาโซนจากชีต", async () => {
    const regionWithNew = statement("ม.ค.", [
      { code: "NAN", name: "รวมน่าน", a: 85, n: 5 },
      { code: "NAN-HO", name: "1.ออฟฟิศน่าน", a: 30 },
      { code: "NAN-402", name: "2.ตั้งจิตอนุสรณ์", a: 20, n: 5 },
      { code: "NAN-403", name: "3.เวียงสา", a: 30 },
      { code: "NAN-499", name: "4.สาขาใหม่", a: 5 },
    ]);
    const masterWithNew = statement("ม.ค.", [
      { code: "MSP", name: "รวมทั้งหมด", a: 235, n: 5 },
      { code: "CM-HO", name: "1.สำนักงานใหญ่", a: 100 },
      { code: "CM-999", name: "2.หน่วยนอกผัง", a: 50 },
      { code: f('"น่าน_"&$B$1', "น่าน_ม.ค."), name: "3.สำนักงานน่าน", a: 30 },
    ]);
    const parsed = await parseStatementWorkbook(await book([{ name: "ม.ค.", rows: masterWithNew }, { name: "น่าน_ม.ค.", rows: regionWithNew }]));
    expect(parsed.months[0].units.get("CM-999")).toEqual({ A: 50 });
    expect(parsed.newUnits).toEqual([
      { code: "CM-999", name: "หน่วยนอกผัง", sheet: "ม.ค.", zoneCode: null },
      { code: "NAN-499", name: "สาขาใหม่", sheet: "น่าน_ม.ค.", zoneCode: "Zone-NAN" },
    ]);
    expect(parsed.mismatches).toEqual([]);
  });

  it("Group ใหม่ในคอลัมน์ A: เก็บยอดไว้พร้อมชื่อ · ส่งเป็น extra แล้วนับในการตรวจยอดรวม", async () => {
    const withNewGroup = master();
    // แถวใหม่ใต้ N: ยอดรวมของชีต (C) 7 · CM-HO (F) 7
    withNewGroup.splice(6, 0, ["QA", "    ค่าบริการใหม่", 7, null, null, 7]);
    const file = await book([{ name: "ม.ค.", rows: withNewGroup }, { name: "น่าน_ม.ค.", rows: region() }]);

    const parsed = await parseStatementWorkbook(file);
    expect(parsed.unknownGroups).toEqual([{ group: "QA", name: "ค่าบริการใหม่", amount: 7 }]);
    expect(parsed.months[0].units.get("CM-HO")).toEqual({ A: 100, QA: 7 });
    // ยังไม่เลือกหมวด = ไม่นับ จึงตรงกับยอดรวมในไฟล์ (ที่ไม่ได้รวม QA)
    expect(parsed.mismatches).toEqual([]);

    const counted = await parseStatementWorkbook(file, [{ code: "QA", name: "ค่าบริการใหม่", section: "admin" }]);
    expect(counted.unknownGroups).toEqual([]);
    expect(counted.mismatches.map((m) => m.key)).toEqual(["OP", "PBT"]);
  });

  it("แจ้งเมื่อยอดรวมในไฟล์ไม่ตรงกับที่ระบบคำนวณ", async () => {
    const parsed = await parseStatementWorkbook(await book([{ name: "ม.ค.", rows: master("ม.ค.", 999) }, { name: "น่าน_ม.ค.", rows: region() }]));
    expect(parsed.mismatches.map((m) => [m.sheet, m.unitCode, m.key])).toEqual([["ม.ค.", "MSP", "REV"], ["ม.ค.", "MSP", "GP"], ["ม.ค.", "MSP", "OP"], ["ม.ค.", "MSP", "PBT"]]);
    expect(parsed.mismatches[0]).toMatchObject({ file: 999, computed: 180 });
  });

  it("ข้ามเดือนที่เป็นชีตร่าง", async () => {
    const empty = statement("ก.พ.", [{ code: "MSP", name: "รวมทั้งหมด", a: 0 }, { code: "CM-HO", name: "1.สำนักงานใหญ่", a: 0 }]);
    const parsed = await parseStatementWorkbook(
      await book([{ name: "ม.ค.", rows: master() }, { name: "น่าน_ม.ค.", rows: region() }, { name: "ก.พ.", rows: empty }]),
    );
    expect(parsed.months.map((m) => m.month)).toEqual([1]);
    expect(parsed.emptyMonths).toEqual([2]);
  });

  it("แจ้งให้แก้สีเมื่อชีตภูมิภาคที่ถูกอ้างถึงไม่ใช่สี #002060", async () => {
    await expect(
      parseStatementWorkbook(await book([{ name: "ม.ค.", rows: master() }, { name: "น่าน_ม.ค.", rows: region(), argb: "FF203764" }])),
    ).rejects.toThrow(/น่าน_ม\.ค\..*#002060/);
  });

  it("ไม่พบชีตงบสี #002060", async () => {
    await expect(parseStatementWorkbook(await book([{ name: "ม.ค.", rows: master(), argb: "FFFF0000" }]))).rejects.toThrow(/งบรวม/);
  });

  it("แจ้งเมื่อรหัสหน่วยซ้ำในเดือนเดียวกัน", async () => {
    const rows = statement("ม.ค.", [{ code: "MSP", name: "รวม", a: 2 }, { code: "X-1", name: "1.ก", a: 1 }, { code: "X-1", name: "2.ข", a: 1 }]);
    await expect(parseStatementWorkbook(await book([{ name: "ม.ค.", rows }]))).rejects.toThrow(/X-1/);
  });

  it("แจ้งเมื่อไม่พบแถวยอดรวม", async () => {
    const rows = statement("ม.ค.", [{ code: "MSP", name: "รวม", a: 1 }, { code: "X-1", name: "1.ก", a: 1 }]).slice(0, 3);
    await expect(parseStatementWorkbook(await book([{ name: "ม.ค.", rows }]))).rejects.toThrow(/ไม่พบแถวยอดรวม/);
  });
});

describe("parseBranchAreas (ชีต Branch_Area)", () => {
  const sheet = (name: string, rows: unknown[][]) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
    return wb;
  };

  it("หาคอลัมน์จากชื่อหัว (ลำดับสลับได้) · ตัวเลขมีคอมมาได้ · ข้ามแถวว่าง", () => {
    const { areas, issues } = parseBranchAreas(
      sheet("Branch_Area", [
        ["พื้นที่ ตร.ม.", "สาขา", "ชื่อสาขา"],
        [850, "CM-101", "สันป่าตอง"],
        [],
        ["1,200.5", "CM-140", "เอ็มพีชมภูมิ่ง"],
      ]),
    );
    expect(areas).toEqual([
      { code: "CM-101", name: "สันป่าตอง", area: 850 },
      { code: "CM-140", name: "เอ็มพีชมภูมิ่ง", area: 1200.5 },
    ]);
    expect(issues).toEqual([]);
  });

  it("หัวคอลัมน์ภาษาอังกฤษ: Zone · Code Branch · Branch · Area (ไม่สนตัวพิมพ์/ช่องว่าง · Zone ไม่ได้ใช้)", () => {
    const { areas, issues } = parseBranchAreas(
      sheet("Branch_Area", [
        ["Zone", "Code Branch", "Branch", "Area"],
        ["CMI", "CM-101", "สันป่าตอง", 850],
        ["NAN", "NAN-408", "เชียงกลาง", "320"],
      ]),
    );
    expect(areas).toEqual([
      { code: "CM-101", name: "สันป่าตอง", area: 850 },
      { code: "NAN-408", name: "เชียงกลาง", area: 320 },
    ]);
    expect(issues).toEqual([]);
    expect(parseBranchAreas(sheet("Branch_Area", [["ZONE", "code  branch", "BRANCH", " area "], ["CMI", "CM-140", "x", 900]])).areas)
      .toEqual([{ code: "CM-140", name: "x", area: 900 }]);
  });

  it("ชื่อชีตไม่สนตัวพิมพ์/ช่องว่าง · ชื่อสาขาไม่บังคับ", () => {
    const { areas } = parseBranchAreas(sheet("branch_area ", [["สาขา", "พื้นที่ตร.ม."], ["NAN-408", 320]]));
    expect(areas).toEqual([{ code: "NAN-408", name: "", area: 320 }]);
  });

  it("รหัสซ้ำ / ตร.ม. ว่าง ไม่ใช่ตัวเลข หรือ ≤ 0 → ข้ามพร้อมเหตุผล", () => {
    const { areas, issues } = parseBranchAreas(
      sheet("Branch_Area", [
        ["สาขา", "ชื่อสาขา", "พื้นที่ ตร.ม."],
        ["A", "a", 100],
        ["A", "a ซ้ำ", 200],
        ["B", "b", "ไม่ทราบ"],
        ["C", "c", 0],
        ["D", "d", null],
      ]),
    );
    expect(areas).toEqual([{ code: "A", name: "a", area: 100 }]);
    expect(issues).toHaveLength(4);
    expect(issues[0]).toContain("ซ้ำ");
  });

  it("ไม่มีชีต = null (นำเข้าแล้วคงค่าเดิม) · มีชีตแต่ไม่มีหัวคอลัมน์ที่ต้องใช้ = แจ้งข้อผิดพลาด", () => {
    expect(parseBranchAreas(sheet("ม.ค.", [["x"]]))).toEqual({ areas: null, issues: [] });
    expect(() => parseBranchAreas(sheet("Branch_Area", [["รหัส", "ขนาด"], ["A", 1]]))).toThrow(ImportError);
  });

  it("อ่านพร้อมไฟล์ Master (parseStatementWorkbook)", async () => {
    const withSheet = await parseStatementWorkbook(
      await book([
        { name: "ม.ค.", rows: master() },
        { name: "น่าน_ม.ค.", rows: region() },
        { name: "Branch_Area", rows: [["สาขา", "ชื่อสาขา", "พื้นที่ ตร.ม."], ["NAN-402", "ตั้งจิตอนุสรณ์", 150]], argb: "FFC00000" },
      ]),
    );
    expect(withSheet.areas).toEqual([{ code: "NAN-402", name: "ตั้งจิตอนุสรณ์", area: 150 }]);
    const without = await parseStatementWorkbook(await book([{ name: "ม.ค.", rows: master() }, { name: "น่าน_ม.ค.", rows: region() }]));
    expect(without.areas).toBeNull();
  });
});