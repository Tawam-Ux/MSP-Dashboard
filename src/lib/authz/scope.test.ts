import { describe, expect, it } from "vitest";
import { buildClosure, defaultUnit, hasPermission, resolveAllowedUnits } from "./scope";

const units = [
  { code: "MSP", parentCode: null },
  { code: "CM-HO", parentCode: "MSP" },
  { code: "NAN", parentCode: "MSP" },
  { code: "NAN-HO", parentCode: "NAN" },
  { code: "NAN-402", parentCode: "NAN" },
];

describe("buildClosure", () => {
  it("มีคู่ของตัวเองและทุกบรรพบุรุษ พร้อมระยะห่าง", () => {
    const rows = buildClosure(units);
    expect(rows).toContainEqual({ ancestor: "NAN-402", descendant: "NAN-402", depth: 0 });
    expect(rows).toContainEqual({ ancestor: "NAN", descendant: "NAN-402", depth: 1 });
    expect(rows).toContainEqual({ ancestor: "MSP", descendant: "NAN-402", depth: 2 });
    expect(rows.filter((r) => r.ancestor === "MSP")).toHaveLength(5);
    expect(rows).toHaveLength(5 + 4 + 2);
  });

  it("แจ้งเมื่อลำดับชั้นวนกลับ", () => {
    expect(() => buildClosure([{ code: "A", parentCode: "B" }, { code: "B", parentCode: "A" }])).toThrow(/วน/);
  });
});

describe("resolveAllowedUnits", () => {
  const closure = buildClosure(units);

  it("สิทธิ์ที่หน่วยแม่ครอบคลุมหน่วยลูกทั้งหมด", () => {
    expect([...resolveAllowedUnits(["NAN"], closure)].sort()).toEqual(["NAN", "NAN-402", "NAN-HO"]);
  });

  it("ไม่มีสิทธิ์ = ไม่เห็นอะไรเลย", () => {
    expect(resolveAllowedUnits([], closure).size).toBe(0);
  });

  it("รวมหลายขอบเขต", () => {
    expect(resolveAllowedUnits(["CM-HO", "NAN-402"], closure)).toEqual(new Set(["CM-HO", "NAN-402"]));
  });
});

describe("defaultUnit", () => {
  const closure = buildClosure(units);

  it("เลือกหน่วยบนสุดที่ผู้ใช้มีสิทธิ์", () => {
    expect(defaultUnit(resolveAllowedUnits(["MSP"], closure), closure)).toBe("MSP");
    expect(defaultUnit(resolveAllowedUnits(["NAN"], closure), closure)).toBe("NAN");
  });

  it("คืน null เมื่อไม่มีสิทธิ์", () => {
    expect(defaultUnit(new Set(), closure)).toBeNull();
  });
});

describe("hasPermission", () => {
  it("ตรวจจากรายการ permission ของผู้ใช้", () => {
    expect(hasPermission({ permissions: ["dashboard.view"] }, "dashboard.view")).toBe(true);
    expect(hasPermission({ permissions: ["dashboard.view"] }, "data.upload")).toBe(false);
  });
});
