import { describe, expect, it } from "vitest";
import { computeStatement as statementOf, nodesForSheet } from "./compute";

describe("ยอดรวมตามไฟล์ (เลือกใช้แทนยอดที่คำนวณ)", () => {
  const tree = [
    { code: "MSP", parentCode: null },
    { code: "Zone-NAN", parentCode: "MSP" },
    { code: "Op-NAN", parentCode: "Zone-NAN" },
    { code: "Sz-NAN", parentCode: "Zone-NAN" },
    { code: "NAN-HO", parentCode: "Op-NAN" },
    { code: "NAN-402", parentCode: "Sz-NAN" },
    { code: "NAN-403", parentCode: "Sz-NAN" },
  ];
  const data = new Set(["NAN-HO", "NAN-402", "NAN-403"]);

  it("nodesForSheet: หน่วยที่หน่วยล่างสุดชุดเดียวกับชีต (ไม่นับคอลัมน์นอกผัง)", () => {
    expect(nodesForSheet(tree, ["NAN-HO", "NAN-402", "NAN-403", "NAN-499"], data).sort()).toEqual(["MSP", "Zone-NAN"]);
    expect(nodesForSheet(tree, ["NAN-402", "NAN-403"], data)).toEqual(["Sz-NAN"]);
    expect(nodesForSheet(tree, ["NAN-402"], data)).toEqual(["NAN-402"]);
    expect(nodesForSheet(tree, ["XX-1"], data)).toEqual([]);
  });

  it("computeStatement: ยอดรวมตามไฟล์แทนยอดที่คำนวณ และรายได้รวมตามไฟล์เป็นฐาน %", () => {
    const lines = statementOf({ A: 100, N: 10 }, { REV: 200, PBT: 50 });
    expect(lines.find((l) => l.totalKey === "REV")).toMatchObject({ amount: "200.00", pct: "100.0000" });
    expect(lines.find((l) => l.totalKey === "PBT")).toMatchObject({ amount: "50.00", pct: "25.0000" });
    expect(lines.find((l) => l.totalKey === "OP")?.amount).toBe("90.00");
  });
});
import { computeStatement, computeTotals, groupPlacements, normalizeGroups, rollup, type GroupAmounts } from "./compute";

describe("computeTotals (Flow ใน รายได้.txt)", () => {
  const g = {
    A: 1000, C: 50, M: 10,
    AA: 300, D: 400, XX: 100, XY: -100, FF: 20, AB: 250,
    BA: 5, J: 10, KK: 3, BB: 4,
    N: 30, Q: 20, R: 100, Z: 50,
    ZZ: 15, ZZZ: 5,
  };
  const t = computeTotals(g);

  it("รายได้รวม = A+B+C+M", () => expect(t.REV).toBe(1060));
  it("ต้นทุนขาย = สินค้ามีไว้เพื่อขาย − AB", () => {
    expect(t.GOODS_AVAIL).toBe(720);
    expect(t.COGS).toBe(470);
  });
  it("ต้นทุนอื่นรวม KK แล้วหัก BB", () => {
    expect(t.OTHER_AVAIL).toBe(18);
    expect(t.OTHER_COST).toBe(14);
    expect(t.TOTAL_COST).toBe(484);
  });
  it("GP → OP → PBT", () => {
    expect(t.GP).toBe(576);
    expect(t.SELLING).toBe(50);
    expect(t.ADMIN).toBe(150);
    expect(t.OP).toBe(376);
    expect(t.PBT).toBe(356);
  });
});

describe("normalizeGroups", () => {
  it("XW/XY ติดลบเสมอ ไม่ว่าไฟล์บันทึกเป็นบวกหรือลบ", () => {
    expect(normalizeGroups({ XW: 619112.39, XY: -5, A: 10 })).toEqual({ XW: -619112.39, XY: -5, A: 10 });
  });
});

describe("computeStatement", () => {
  it("แถวงบมี % จากรายได้รวม และยอดรวมตรงกับ computeTotals", () => {
    const rows = computeStatement({ A: 200, R: 50 });
    const pbt = rows.find((r) => r.totalKey === "PBT")!;
    expect(pbt).toMatchObject({ amount: "150.00", pct: "75.0000", kind: "total" });
    expect(rows.find((r) => r.groupCode === "A")).toMatchObject({ label: "รายได้จากการขาย", pct: "100.0000" });
    expect(rows.map((r) => r.lineNo)).toEqual(rows.map((_, i) => i + 1));
  });

  it("ไม่มีรายได้ = ไม่มี %", () => {
    const rows = computeStatement({ R: 50 });
    expect(rows.find((r) => r.totalKey === "PBT")).toMatchObject({ amount: "-50.00", pct: null });
  });
});

describe("Group ใหม่ที่เลือกหมวดแล้ว (extra)", () => {
  const g = { A: 1000, QA: 100, QB: 40, QC: 10 };
  const extra = [
    { code: "QA", name: "ต้นทุนใหม่", section: "cogs" as const },
    { code: "QB", name: "ค่าใช้จ่ายใหม่", section: "admin" as const },
    { code: "QC", name: "รายการใต้ OP", section: "finance" as const },
  ];

  it("ไม่ส่ง extra = Group ใหม่ไม่ถูกนับ", () => {
    expect(computeTotals(g)).toMatchObject({ REV: 1000, GP: 1000, OP: 1000, PBT: 1000 });
  });

  it("ยอดบวกเข้ายอดรวมของหมวด", () => {
    const t = computeTotals(g, extra);
    expect(t).toMatchObject({ GOODS_AVAIL: 100, COGS: 100, GP: 900, ADMIN: 40, OP: 860, PBT: 850 });
  });

  it("แถวใหม่อยู่ท้ายหมวด ก่อนแถวยอดรวม พร้อมชื่อจากไฟล์", () => {
    const rows = computeStatement(g, undefined, extra);
    const at = (pred: (r: (typeof rows)[number]) => boolean) => rows.findIndex(pred);
    expect(at((r) => r.groupCode === "QA")).toBe(at((r) => r.totalKey === "GOODS_AVAIL") - 1);
    expect(at((r) => r.groupCode === "QB")).toBe(at((r) => r.totalKey === "ADMIN") - 1);
    expect(at((r) => r.groupCode === "QC")).toBe(at((r) => r.totalKey === "PBT") - 1);
    expect(rows.find((r) => r.groupCode === "QA")).toMatchObject({ label: "ต้นทุนใหม่", indent: true, amount: "100.00" });
    expect(rows.find((r) => r.totalKey === "PBT")?.amount).toBe("850.00");
    expect(rows.map((r) => r.lineNo)).toEqual(rows.map((_, i) => i + 1));
  });
});

describe("groupPlacements (หน้า Group ในแอปหลังบ้าน)", () => {
  it("ทุก Group ตามลำดับแถวในงบ พร้อมหมวดและผลต่อยอดรวม · Group ใหม่แทรกท้ายหมวด", () => {
    const placed = groupPlacements([{ code: "QA", name: "ค่าใหม่", section: "selling" }]);
    expect(placed.map((p) => p.code).slice(24, 29)).toEqual(["N", "O", "P", "Q", "QA"]);
    expect(placed.find((p) => p.code === "QA")).toMatchObject({ inFlow: false, defaultName: "ค่าใหม่", effect: "บวกเข้า รวมค่าใช้จ่ายขาย" });
    expect(placed.find((p) => p.code === "AB")?.effect).toMatch(/^หักจาก/);
    expect(placed.find((p) => p.code === "ZZ")).toMatchObject({ section: "finance", inFlow: true });
  });
});

describe("rollup", () => {
  it("หน่วยแม่ = ผลรวมของตัวเองและลูกหลาน · หน่วยที่ไม่มีข้อมูลไม่ถูกคืน", () => {
    const tree = [
      { code: "MSP", parentCode: null },
      { code: "NAN", parentCode: "MSP" },
      { code: "NAN-HO", parentCode: "NAN" },
      { code: "NAN-402", parentCode: "NAN" },
      { code: "PD", parentCode: "MSP" },
    ];
    const out = rollup(tree, new Map<string, GroupAmounts>([["NAN-HO", { R: 10 }], ["NAN-402", { A: 100, R: 5 }]]));
    expect(out.get("NAN")).toEqual({ R: 15, A: 100 });
    expect(out.get("MSP")).toEqual({ R: 15, A: 100 });
    expect(out.has("PD")).toBe(false);
  });
});
