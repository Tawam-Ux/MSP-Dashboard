import { describe, expect, it } from "vitest";
import { buildTimelines, isTimelineSpan } from "./series";

/** งวดรายเดือนของปี ค.ศ. year ตั้งแต่เดือน from ถึง to */
const months = (year: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${year}-${String(from + i).padStart(2, "0")}-01`);

describe("isTimelineSpan", () => {
  // ระบบมีข้อมูล ม.ค.–ธ.ค. 68 และ ม.ค.–ส.ค. 69 (20 เดือน)
  const usable = [...months(2025, 1, 12), ...months(2026, 1, 8)];

  it("ทั้งปี = ครบทุกเดือนที่มีข้อมูลของปีนั้น", () => {
    expect(isTimelineSpan(months(2026, 1, 8), false, usable)).toBe(true);
    expect(isTimelineSpan(months(2025, 1, 12), false, usable)).toBe(true);
  });

  it("ทุกเดือนที่มี (all) แสดงเสมอ แม้ข้ามปี", () => {
    expect(isTimelineSpan(usable, true, usable)).toBe(true);
  });

  it("เลือกบางเดือน เดือนเดียว หรือข้ามปีไม่ครบ ไม่แสดง", () => {
    expect(isTimelineSpan(months(2026, 1, 3), false, usable)).toBe(false);
    expect(isTimelineSpan(["2026-08-01"], false, usable)).toBe(false);
    expect(isTimelineSpan([...months(2025, 11, 12), ...months(2026, 1, 2)], false, usable)).toBe(false);
  });

  it("ปีที่มีข้อมูลเดือนเดียว ไม่นับเป็นทั้งปี (ต้องมีอย่างน้อย 2 เดือน)", () => {
    expect(isTimelineSpan(["2027-01-01"], false, [...usable, "2027-01-01"])).toBe(false);
  });

  it("ทั้งปีนับตามเดือนที่เลือกได้ (Sales Zone กรองสาขาแล้วเหลือบางเดือน)", () => {
    const branchMonths = [...months(2025, 1, 12), ...months(2026, 3, 8)];
    expect(isTimelineSpan(months(2026, 3, 8), false, branchMonths)).toBe(true);
    expect(isTimelineSpan(months(2026, 3, 7), false, branchMonths)).toBe(false);
  });
});

describe("buildTimelines", () => {
  const monthly = new Map([
    ["2026-01-01", { REV: 100, GP: 30, TOTAL_COST: 70, SGA: 10, OP: 20, PBT: 15 }],
    ["2026-03-01", { REV: 120, GP: -5, TOTAL_COST: 125, SGA: 12, OP: -17, PBT: -20 }],
  ]);
  const t = buildTimelines(months(2026, 1, 3), monthly);

  it("เรียงตามงวดที่เลือก · เดือนที่ไม่มีงบเป็น null (เส้นขาด ไม่ใช่ศูนย์)", () => {
    expect(t.REV.map((p) => p.value)).toEqual([100, null, 120]);
    expect(t.GP[1]).toEqual({ period: "2026-02-01", value: null, revenue: null });
  });

  it("ต้นทุนและค่าใช้จ่ายรวม = ต้นทุนขาย + SG&A + ค่าเสื่อม/ดอกเบี้ย (OP − PBT) แบบการ์ดหน้า Operations", () => {
    expect(t.EXP[0]).toEqual({ period: "2026-01-01", value: 85, revenue: 100 });
    expect(t.EXP[2].value).toBe(140);
  });

  it("ทุกจุดมีรายได้ของเดือนนั้นไว้คิด % ของรายได้", () => {
    expect(t.PBT[2]).toEqual({ period: "2026-03-01", value: -20, revenue: 120 });
    expect(t.OP.map((p) => p.revenue)).toEqual([100, null, 120]);
  });
});
