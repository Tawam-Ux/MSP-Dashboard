import { describe, expect, it } from "vitest";
import { niceTicks, rankGeometry } from "./rank-geometry";

describe("niceTicks", () => {
  it("เลขแกนลงตัว ครอบช่วงข้อมูล", () => {
    expect(niceTicks(0, 85123)).toEqual([0, 25000, 50000, 75000, 100000]);
    expect(niceTicks(-12.3, 28.4)).toEqual([-20, 0, 20, 40]);
  });

  it("ช่วงเป็นศูนย์ยังได้แกนที่ใช้ได้", () => {
    expect(niceTicks(0, 0).length).toBeGreaterThan(1);
  });
});

describe("rankGeometry", () => {
  it("เส้นตัดเกณฑ์ระหว่างสาขาสุดท้ายที่ผ่านกับสาขาแรกที่ต่ำกว่า", () => {
    const g = rankGeometry([100, 80, 60, 40], 70, 340);
    expect(g.pass).toBe(2);
    expect(g.crossX).toBeCloseTo(186, 0);
  });

  it("ผ่านทั้งหมด / ต่ำกว่าทั้งหมด: ไม่มีจุดตัด", () => {
    expect(rankGeometry([100, 90], 50, 340)).toMatchObject({ pass: 2, crossX: null });
    expect(rankGeometry([40, 30], 50, 340)).toMatchObject({ pass: 0, crossX: null });
  });

  it("ไม่มีเกณฑ์: ไม่มีเส้นเกณฑ์ พื้นช่วงต่ำกว่าเกณฑ์ และจำนวนที่ผ่าน", () => {
    expect(rankGeometry([100, 90], null, 340)).toMatchObject({ benchY: null, shortfall: "", pass: null, crossX: null });
  });

  it("แกนเริ่มที่ 0 และครอบเกณฑ์เสมอ (เกณฑ์สูงกว่าทุกสาขาก็ยังอยู่ในกราฟ)", () => {
    const g = rankGeometry([40, 30], 50, 340);
    expect(g.ticks[0].value).toBe(0);
    expect(g.ticks.at(-1)!.value).toBeGreaterThanOrEqual(50);
    expect(g.benchY!).toBeGreaterThanOrEqual(g.plot.top);
  });

  it("ค่าติดลบ: เส้น 0 อยู่กลางกราฟ", () => {
    const g = rankGeometry([20, -10], 5, 340);
    expect(g.zeroY).toBeGreaterThan(g.plot.top);
    expect(g.zeroY).toBeLessThan(g.plot.bottom);
  });

  it("เลขอันดับใต้กราฟ: 1 · ทุก 10/20 · อันดับสุดท้าย ไม่ชนกัน", () => {
    const desc = (n: number) => Array.from({ length: n }, (_, i) => 100 - i);
    expect(rankGeometry(desc(57), 50, 800).ranks.map((r) => r.rank)).toEqual([1, 10, 20, 30, 40, 50, 57]);
    expect(rankGeometry(desc(61), 50, 800).ranks.map((r) => r.rank)).toEqual([1, 20, 40, 61]);
    expect(rankGeometry([5], 3, 340).ranks.map((r) => r.rank)).toEqual([1]);
  });
});
