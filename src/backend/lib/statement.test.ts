import { describe, expect, it } from "vitest";
import { ACCOUNTS, statementFromLines, sumPeriodStatements, sumStatements, visibleStatementLines, type FileLine } from "./statement";

const line = (lineNo: number, p: Partial<FileLine>): FileLine => ({
  lineNo, kind: "account", groupCode: null, totalKey: null, label: "", indent: false, amount: null, pct: null, ...p,
});

const SAMPLE: FileLine[] = [
  line(3, { groupCode: "A", label: "รายได้จากการขาย", amount: 1000, pct: 95.2 }),
  line(7, { kind: "total", totalKey: "REV", label: "รายได้รวม", amount: 1050, pct: 100 }),
  line(8, { kind: "heading", label: "ต้นทุนขาย" }),
  line(10, { groupCode: "D", label: "ซื้อ-หมูขุน", indent: true, amount: 600, pct: 57.1 }),
  // ยอดรวมในไฟล์ต่างจากผลบวกของบัญชีโดยเจตนา — ระบบต้องใช้ค่าจากไฟล์ ไม่คำนวณใหม่
  line(57, { kind: "total", totalKey: "PBT", label: "กำไร(ขาดทุน) ก่อนภาษี", amount: 123.45, pct: 11.76 }),
];

describe("sumPeriodStatements", () => {
  // เดือนละงบ: ต้นงวด AA · ซื้อ D · ปลายงวด AB (ต้นงวดเดือน 2 = ปลายงวดเดือน 1)
  const month = (aa: number, d: number, ab: number) =>
    statementFromLines([
      line(1, { groupCode: "A", amount: 1000 }),
      line(2, { kind: "total", totalKey: "REV", amount: 1000 }),
      line(3, { groupCode: "AA", amount: aa }),
      line(4, { groupCode: "D", amount: d }),
      line(5, { kind: "total", totalKey: "GOODS_AVAIL", amount: aa + d }),
      line(6, { groupCode: "AB", amount: ab }),
      line(7, { kind: "total", totalKey: "COGS", amount: aa + d - ab }),
    ]);

  it("ต้นงวด = งวดแรก · ปลายงวด = งวดสุดท้าย · ต้นทุนขาย = ผลบวกรายเดือน (แบบคอลัมน์รวมของชีต Monthy)", () => {
    const s = sumPeriodStatements([month(100, 500, 80), month(80, 400, 120)]);
    const value = (code: string) => {
      const l = s.lines.find((x) => x.kind === "account" && x.code === code);
      return l?.kind === "account" ? l.value : undefined;
    };
    expect(value("AA")).toBe(100);
    expect(value("AB")).toBe(120);
    expect(value("D")).toBe(900);
    expect(s.totals.GOODS_AVAIL).toBe(1000);
    expect(s.totals.COGS).toBe(880);
    expect(s.totals.GOODS_AVAIL - value("AB")!).toBe(s.totals.COGS);
  });
});

describe("ACCOUNTS", () => {
  it("มีรหัสบัญชีไม่ซ้ำ", () => {
    const codes = ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("statementFromLines", () => {
  it("ใช้ยอดเงินและ % จากไฟล์ตรงๆ ไม่คำนวณยอดรวมเอง", () => {
    const s = statementFromLines(SAMPLE);
    expect(s.totals.REV).toBe(1050);
    expect(s.totals.PBT).toBe(123.45);
    expect(s.lines.find((l) => l.kind === "account" && l.code === "A")).toMatchObject({ value: 1000, pctOfRevenue: 95.2 });
  });

  it("คงลำดับแถวและหัวข้อตามไฟล์", () => {
    const s = statementFromLines([...SAMPLE].reverse());
    expect(s.lines.map((l) => l.name)).toEqual(["รายได้จากการขาย", "รายได้รวม", "ต้นทุนขาย", "ซื้อ-หมูขุน", "กำไร(ขาดทุน) ก่อนภาษี"]);
    expect(s.lines[2].kind).toBe("heading");
    expect(s.lines[1]).toMatchObject({ kind: "total", emphasis: "major" });
  });

  it("ยอดรวมที่ไม่มีในไฟล์เป็น 0", () => {
    expect(statementFromLines(SAMPLE).totals.GP).toBe(0);
  });
});

describe("visibleStatementLines", () => {
  // โครงเดียวกับชีตงบ: ต้นทุนขาย → ต้นทุนขายอื่นๆ → กำไรขั้นต้น → หมวดค่าใช้จ่าย → ค่าเสื่อมหลังกำไรจากการดำเนินงาน
  const statement = (v: { other?: number; otherTotal?: number; admin?: number; adminTotal?: number }) =>
    statementFromLines([
      line(1, { groupCode: "A", label: "รายได้จากการขาย", amount: 1000 }),
      line(2, { kind: "total", totalKey: "REV", label: "รายได้รวม", amount: 1000 }),
      line(3, { kind: "heading", label: "ต้นทุนขาย" }),
      line(4, { groupCode: "XX", label: "ต้นทุนขาย", amount: 600 }),
      line(5, { groupCode: "XZ", label: "Shopping Bag", amount: 0 }),
      line(6, { kind: "total", totalKey: "GOODS_AVAIL", label: "สินค้ามีไว้เพื่อขาย", amount: 600 }),
      line(7, { kind: "total", totalKey: "COGS", label: "รวมต้นทุนขาย", amount: 600 }),
      line(8, { kind: "heading", label: "ต้นทุนขายอื่นๆ" }),
      line(9, { groupCode: "J", label: "ซื้ออาหาร", amount: v.other ?? 0 }),
      line(10, { kind: "total", totalKey: "OTHER_AVAIL", label: "สินค้ามีไว้เพื่อขาย (อื่น)", amount: v.otherTotal ?? v.other ?? 0 }),
      line(11, { kind: "total", totalKey: "OTHER_COST", label: "รวมต้นทุนอื่น", amount: v.otherTotal ?? v.other ?? 0 }),
      line(12, { kind: "total", totalKey: "TOTAL_COST", label: "รวมต้นทุนเพื่อขาย", amount: 600 }),
      line(13, { kind: "total", totalKey: "GP", label: "กำไรขั้นต้น", amount: 400 }),
      line(14, { kind: "heading", label: "ค่าใช้จ่ายในการบริหาร" }),
      line(15, { groupCode: "R", label: "เงินเดือน", amount: v.admin ?? 0 }),
      line(16, { kind: "total", totalKey: "ADMIN", label: "รวมค่าใช้จ่ายบริหาร", amount: v.adminTotal ?? v.admin ?? 0 }),
      line(17, { kind: "total", totalKey: "OP", label: "กำไรจากการดำเนินงาน", amount: 400 }),
      line(18, { groupCode: "ZZ", label: "ค่าเสื่อมราคา", amount: 50 }),
      line(19, { kind: "total", totalKey: "PBT", label: "กำไรก่อนภาษี", amount: 350 }),
    ]);
  const names = (s: ReturnType<typeof statement>) => visibleStatementLines(s.lines).map((l) => l.name);

  it("หมวดที่เป็น 0 ทั้งหมวด: ซ่อนหัวข้อ บัญชี และยอดรวมย่อย แต่คงยอดรวมที่ไม่เป็น 0 และยอดรวมหลัก", () => {
    expect(names(statement({}))).toEqual([
      "รายได้จากการขาย", "รายได้รวม",
      "ต้นทุนขาย", "ต้นทุนขาย", "สินค้ามีไว้เพื่อขาย", "รวมต้นทุนขาย",
      "รวมต้นทุนเพื่อขาย", "กำไรขั้นต้น",
      "กำไรจากการดำเนินงาน", "ค่าเสื่อมราคา", "กำไรก่อนภาษี",
    ]);
  });

  it("หมวดที่มีบัญชีไม่เป็น 0 แสดงครบ ทั้งหัวข้อและยอดรวมย่อย", () => {
    expect(names(statement({ other: 30, admin: 80 }))).toEqual([
      "รายได้จากการขาย", "รายได้รวม",
      "ต้นทุนขาย", "ต้นทุนขาย", "สินค้ามีไว้เพื่อขาย", "รวมต้นทุนขาย",
      "ต้นทุนขายอื่นๆ", "ซื้ออาหาร", "สินค้ามีไว้เพื่อขาย (อื่น)", "รวมต้นทุนอื่น",
      "รวมต้นทุนเพื่อขาย", "กำไรขั้นต้น",
      "ค่าใช้จ่ายในการบริหาร", "เงินเดือน", "รวมค่าใช้จ่ายบริหาร",
      "กำไรจากการดำเนินงาน", "ค่าเสื่อมราคา", "กำไรก่อนภาษี",
    ]);
  });

  it("ยอดรวมย่อยที่เป็น 0 แต่หมวดยังมีบัญชี (หักลบกันพอดี) ยังแสดงไว้", () => {
    expect(names(statement({ admin: 80, adminTotal: 0 }))).toContain("รวมค่าใช้จ่ายบริหาร");
  });

  it("ยอดรวมย่อยที่ไม่เป็น 0 แสดงเสมอ แม้หมวดไม่มีบัญชีเหลือ", () => {
    expect(names(statement({ otherTotal: 20 }))).toContain("รวมต้นทุนอื่น");
  });

  it("ค่าเสื่อมหลังกำไรจากการดำเนินงานไม่ทำให้หมวดบริหารที่เป็น 0 กลับมาแสดง", () => {
    expect(names(statement({}))).not.toContain("ค่าใช้จ่ายในการบริหาร");
    expect(names(statement({}))).not.toContain("รวมค่าใช้จ่ายบริหาร");
  });
});

describe("sumStatements (YTD)", () => {
  it("บวกแถวเดียวกันข้ามงวด และคิด % จากรายได้สะสม", () => {
    const s = sumStatements([statementFromLines(SAMPLE), statementFromLines(SAMPLE)]);
    expect(s.totals.REV).toBe(2100);
    expect(s.totals.PBT).toBe(246.9);
    const a = s.lines.find((l) => l.kind === "account" && l.code === "A");
    expect(a).toMatchObject({ value: 2000 });
    expect(a && a.kind === "account" ? a.pctOfRevenue : null).toBeCloseTo(95.238, 2);
  });
});
