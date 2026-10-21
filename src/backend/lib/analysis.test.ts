import { describe, expect, it } from "vitest";
import { average, classifyUnits, costAccounts, pooledRatio, ratioOf } from "./analysis";
import type { UnitNode } from "./reports";
import type { ComputedLine, Statement } from "./statement";

describe("costAccounts (การ์ดต้นทุนที่ขยับมากสุด)", () => {
  const acc = (code: string, value: number): ComputedLine => ({ kind: "account", code, name: code, indent: false, value, pctOfRevenue: null });
  const tot = (key: "REV" | "GP", value: number): ComputedLine => ({ kind: "total", key, name: key, emphasis: "major", value, pctOfRevenue: null });
  const s = {
    lines: [
      acc("A", 1000), tot("REV", 1000),
      acc("AA", 300), acc("D", 500), acc("XX", 400), acc("XY", -400), acc("XQ", 7), acc("XW", -7), acc("AB", 250),
      acc("BA", 0), acc("J", 20), acc("BB", 0),
      tot("GP", 430), acc("R", 99),
    ],
    totals: {},
  } as unknown as Statement;

  it("เฉพาะบัญชีระหว่างรายได้รวมกับกำไรขั้นต้น · ไม่รวมบัญชีพัก · สินค้าคงเหลือสุทธิเป็นแถวเดียว", () => {
    expect(costAccounts(s).map((a) => [a.code, a.value])).toEqual([["D", 500], ["INV", 50], ["J", 20]]);
  });

  it("ผลรวมเท่ากับต้นทุนรวมของงบ (รายได้ − กำไรขั้นต้น)", () => {
    expect(costAccounts(s).reduce((t, a) => t + a.value, 0)).toBe(1000 - 430);
  });
});

describe("pooledRatio (เกณฑ์ GP/PBT Margin ของโซน)", () => {
  const branches = [
    { value: 750_000, revenue: 5_000_000 }, // 15%
    { value: 50_000, revenue: 1_000_000 }, // 5% (สาขาเล็ก)
    { value: 520_000, revenue: 4_000_000 }, // 13%
  ];

  it("= ผลรวม GP ÷ ผลรวมรายได้ (ถ่วงตามยอดขาย) ไม่ใช่ค่าเฉลี่ยของ % รายสาขา", () => {
    expect(pooledRatio(branches)).toBeCloseTo(13.2);
    expect(average(branches.map((b) => ratioOf(b.value, b.revenue)!))).toBeCloseTo(11); // วิธีเดิม
  });

  it("สาขาเล็กที่ % ผิดปกติแทบไม่ขยับเกณฑ์ของโซน", () => {
    const withTiny = [...branches, { value: -40_000, revenue: 50_000 }]; // -80% ยอดขายแค่ 50,000
    expect(pooledRatio(withTiny)! - pooledRatio(branches)!).toBeGreaterThan(-0.6);
    expect(average(withTiny.map((b) => ratioOf(b.value, b.revenue)!))! - 11).toBeLessThan(-20); // วิธีเดิมตกฮวบ
  });

  it("ไม่มีรายได้ → null", () => {
    expect(pooledRatio([])).toBeNull();
    expect(pooledRatio([{ value: 10, revenue: 0 }])).toBeNull();
  });
});

const n = (code: string, parentCode: string | null, hasChildren = false, category: UnitNode["category"] = null): UnitNode => ({
  code, name: code, parentCode, level: 0, sortOrder: 0, hasChildren, category,
});

const codes = (r: ReturnType<typeof classifyUnits>) => ({
  zones: r.zones.map((z) => [z.code, z.branches.map((b) => b.code)]),
  operations: r.operations.map((o) => o.code),
});

describe("classifyUnits", () => {
  it("ไม่ได้ตั้งประเภท → ใช้กฎตามผัง: หน่วยที่ลูกทุกตัวเป็นหน่วยล่างสุด = โซน, หน่วยล่างสุดอื่น = Operations", () => {
    const nodes = [n("MSP", null, true), n("CMI", "MSP", true), n("CM-101", "CMI"), n("CM-102", "CMI"), n("HO", "MSP")];
    expect(codes(classifyUnits(nodes))).toEqual({ zones: [["CMI", ["CM-101", "CM-102"]]], operations: ["HO"] });
  });

  it("ตั้ง operations → ไป Operations แม้หน่วยแม่จะเข้ากฎโซน", () => {
    const nodes = [
      n("MSP", null, true), n("CMI", "MSP", true), n("CM-101", "CMI"),
      n("FARM", "MSP", true), n("FAC-PIG1", "FARM", false, "operations"), n("FAC-PIG2", "FARM", false, "operations"),
    ];
    expect(codes(classifyUnits(nodes))).toEqual({ zones: [["CMI", ["CM-101"]]], operations: ["FAC-PIG1", "FAC-PIG2"] });
  });

  it("ตั้ง sales → เป็นสาขาในโซนของหน่วยแม่ แม้ตามผังจะเป็น Operations", () => {
    const nodes = [n("MSP", null, true), n("NORTH", "MSP", true), n("SUB", "NORTH", true), n("SUB-1", "SUB"), n("N-1", "NORTH", false, "sales")];
    expect(codes(classifyUnits(nodes))).toEqual({ zones: [["NORTH", ["N-1"]], ["SUB", ["SUB-1"]]], operations: [] });
  });

  it("โซนผสม: หน่วยที่ตั้ง operations ถูกแยกออกจากรายการสาขาของโซน", () => {
    const nodes = [n("MSP", null, true), n("CMI", "MSP", true), n("CM-101", "CMI"), n("CM-WH", "CMI", false, "operations")];
    expect(codes(classifyUnits(nodes))).toEqual({ zones: [["CMI", ["CM-101"]]], operations: ["CM-WH"] });
  });

  it("ประเภทของหน่วยที่มีลูกไม่มีผล", () => {
    const nodes = [n("MSP", null, true), n("CMI", "MSP", true, "operations"), n("CM-101", "CMI")];
    expect(codes(classifyUnits(nodes))).toEqual({ zones: [["CMI", ["CM-101"]]], operations: [] });
  });

  it("ไม่เห็นหน่วยแม่ → ไม่แสดงทั้งสองหน้า", () => {
    expect(codes(classifyUnits([n("CM-101", "CMI", false, "sales"), n("HO", "MSP", false, "operations")]))).toEqual({ zones: [], operations: [] });
  });
});
