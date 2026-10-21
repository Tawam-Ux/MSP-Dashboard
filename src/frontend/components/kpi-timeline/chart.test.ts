import { describe, expect, it } from "vitest";
import { SWEEP_EASE, bezierTimeAt, chartDomain, chartGeometry, monthTicks } from "./chart";
import type { TimelinePoint } from "./series";

const point = (period: string, value: number | null): TimelinePoint => ({ period, value, revenue: value == null ? null : 100 });
const months = (year: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${year}-${String(from + i).padStart(2, "0")}-01`);

describe("chartDomain", () => {
  it("พอดีข้อมูลเมื่อค่าไม่ห่างจากกันมาก (เห็นความต่างรายเดือนชัด)", () => {
    expect(chartDomain([80, 100, 120])).toEqual({ lo: 80, hi: 120 });
  });

  it("รวม 0 เมื่อค่าต่ำสุดใกล้ศูนย์ ไม่ให้ขนาดหลอกตา", () => {
    expect(chartDomain([10, 100])).toEqual({ lo: 0, hi: 100 });
    expect(chartDomain([-100, -20])).toEqual({ lo: -100, hi: 0 });
  });

  it("ข้ามศูนย์ใช้ค่าจริงทั้งสองฝั่ง · ติดลบทั้งหมดแต่ห่างศูนย์ ไม่ดึงถึง 0", () => {
    expect(chartDomain([-20, 50])).toEqual({ lo: -20, hi: 50 });
    expect(chartDomain([-50, -40])).toEqual({ lo: -50, hi: -40 });
  });

  it("ค่าเท่ากันทุกเดือน เผื่อช่วงให้เส้นอยู่กลางกราฟ", () => {
    expect(chartDomain([100, 100])).toEqual({ lo: 90, hi: 110 });
    expect(chartDomain([0, 0])).toEqual({ lo: -1, hi: 1 });
  });
});

describe("bezierTimeAt", () => {
  it("linear: เวลา = ความคืบหน้า", () => {
    expect(bezierTimeAt(0.3, [0, 0, 1, 1])).toBeCloseTo(0.3, 3);
  });

  it("หัวท้ายตรงกัน", () => {
    expect(bezierTimeAt(0, SWEEP_EASE)).toBeCloseTo(0, 3);
    expect(bezierTimeAt(1, SWEEP_EASE)).toBeCloseTo(1, 3);
  });

  it("ease-out ไปถึงครึ่งทางก่อนครึ่งเวลา", () => {
    expect(bezierTimeAt(0.5, [0.16, 1, 0.3, 1])).toBeLessThan(0.3);
  });
});

describe("chartGeometry", () => {
  it("เดือนแรกชิดซ้าย เดือนสุดท้ายชิดขวา (เว้นขอบให้วงแหวนสถานี)", () => {
    const g = chartGeometry([point("2026-01-01", 10), point("2026-02-01", 20), point("2026-03-01", 15)], 220);
    expect(g.xs).toEqual([10, 110, 210]);
    expect(g.step).toBe(100);
  });

  it("เดือนที่ไม่มีค่า: เส้นขาดเป็นช่วง พื้นไม่ลากข้าม · จุดเดี่ยวไม่มีพื้น", () => {
    const g = chartGeometry(
      [point("2026-01-01", 10), point("2026-02-01", 20), point("2026-03-01", null), point("2026-04-01", 15), point("2026-05-01", null), point("2026-06-01", 12)],
      420,
    );
    expect(g.line.match(/M/g)).toHaveLength(3);
    expect(g.area.match(/M/g)).toHaveLength(1);
    expect(g.stations.map((s) => s.index)).toEqual([0, 1, 3, 5]);
  });

  it("ข้อมูลข้ามศูนย์: มีเส้น 0 และพื้นยึดเส้น 0", () => {
    const g = chartGeometry([point("2026-01-01", 50), point("2026-02-01", -20), point("2026-03-01", 30)], 220);
    expect(g.zeroY).not.toBeNull();
    expect(g.baseY).toBe(g.zeroY);
    expect(g.stations[1].y).toBeGreaterThan(g.zeroY!);
  });

  it("ข้อมูลบวกที่แกนไม่รวม 0: ไม่มีเส้น 0 ฐานพื้นคือขอบล่างกราฟ", () => {
    const g = chartGeometry([point("2026-01-01", 80), point("2026-02-01", 100), point("2026-03-01", 120)], 220);
    expect(g.zeroY).toBeNull();
    expect(g.baseY).toBe(g.stations[0].y);
  });

  it("ป้ายค่าสูงสุด/ต่ำสุด (ค่าซ้ำเลือกเดือนหลังสุด) · น้อยกว่า 3 จุดไม่มีป้าย", () => {
    const g = chartGeometry([point("2026-01-01", 120), point("2026-02-01", 80), point("2026-03-01", 120)], 220);
    expect(g.max?.index).toBe(2);
    expect(g.min?.index).toBe(1);
    expect(chartGeometry([point("2026-01-01", 1), point("2026-02-01", 2)], 220).max).toBeNull();
  });
});

describe("monthTicks", () => {
  it("ปีเดียว เดือนห่างพอ: ชื่อเดือนครบทุกเดือน", () => {
    const pts = months(2026, 1, 8).map((p) => point(p, 1));
    const g = chartGeometry(pts, 360);
    expect(monthTicks(pts, g.xs, g.step).map((t) => t.label)).toEqual(["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค."]);
  });

  it("ข้ามปี เดือนถี่: เว้นระยะไม่ให้ชนกัน เติมปี พ.ศ. และแสดงเดือนสุดท้ายเสมอ", () => {
    const pts = [...months(2025, 1, 12), ...months(2026, 1, 8)].map((p) => point(p, 1));
    const g = chartGeometry(pts, 360);
    const ticks = monthTicks(pts, g.xs, g.step);
    expect(ticks[0].label).toBe("ม.ค. 68");
    expect(ticks.at(-1)!.label).toBe("ส.ค. 69");
    for (let i = 1; i < ticks.length; i++) expect(g.xs[ticks[i].index] - g.xs[ticks[i - 1].index]).toBeGreaterThanOrEqual(44);
  });
});
