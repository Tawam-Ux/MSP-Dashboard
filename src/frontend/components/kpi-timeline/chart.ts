// เรขาคณิตของกราฟ Timeline — ฟังก์ชันล้วน ไม่แตะ DOM (ตำแหน่งการ์ดที่ขยายอยู่ที่ expand-card/geometry.ts)
import { MONTHS_SHORT } from "@/backend/lib/format";
import type { TimelinePoint } from "./series";

/** ความสูงพื้นที่กราฟ (ไม่รวมแถวชื่อเดือน) */
export const CHART_H = 136;
/** เผื่อวงแหวนสถานีที่หัวท้ายเส้น */
const PAD_X = 10;
/** ที่ว่างเหนือจุดสูงสุด/ใต้จุดต่ำสุด สำหรับป้ายตัวเลข */
const PLOT_TOP = 24;
const PLOT_BOTTOM = 22;

/** จังหวะกวาดเส้น: ออกตัวนุ่ม แล้วชะลอเข้าเดือนล่าสุด — CSS ใช้ค่าเดียวกันผ่าน --kt-sweep-ease */
export const SWEEP_EASE = [0.5, 0, 0.2, 1] as const;
export const SWEEP_MS = 720;
/** เริ่มกวาดเมื่อการ์ดขยายไปได้ราวครึ่งทาง */
export const SWEEP_DELAY_MS = 160;

type Curve = readonly [number, number, number, number];

/** เลขเดือนต่อเนื่อง (ปี×12 + เดือน) — เดือนติดกันต่างกัน 1 */
const monthIndex = (period: string) => Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
const round = (n: number) => Math.round(n * 10) / 10;

/** ช่วงแกน Y: พอดีข้อมูล (เห็นความต่างรายเดือนชัด) · รวม 0 เมื่อข้ามศูนย์ หรือค่าที่ใกล้ศูนย์ที่สุดไม่ถึง 35% ของอีกปลาย ไม่ให้ขนาดหลอกตา */
export function chartDomain(values: number[]): { lo: number; hi: number } {
  if (values.length === 0) return { lo: 0, hi: 1 };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo > 0 && lo < hi * 0.35) lo = 0;
  if (hi < 0 && hi > lo * 0.35) hi = 0;
  if (hi === lo) {
    const pad = Math.max(Math.abs(hi) * 0.1, 1);
    return { lo: lo - pad, hi: hi + pad };
  }
  return { lo, hi };
}

/** เวลา (0–1) ที่ cubic-bezier ไปถึงความคืบหน้า progress — ใช้จับจังหวะให้สถานีโผล่ตอนเส้นกวาดไปถึง */
export function bezierTimeAt(progress: number, [x1, y1, x2, y2]: Curve): number {
  const at = (s: number, a: number, b: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
  const target = Math.min(1, Math.max(0, progress));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid, y1, y2) < target) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, x1, x2);
}

export const cssBezier = (c: Curve) => `cubic-bezier(${c.join(", ")})`;

/** เดือนที่มีค่าบนกราฟ (สถานี) */
export type Station = { index: number; x: number; y: number; value: number };

export type ChartGeometry = {
  /** ตำแหน่ง x ของทุกเดือน (รวมเดือนที่ไม่มีค่า) */
  xs: number[];
  stations: Station[];
  /** เส้น: ขาดตอนเดือนที่ไม่มีค่า */
  line: string;
  /** พื้นใต้เส้นถึงฐาน (ช่วงที่มีจุดเดียวไม่มีพื้น) */
  area: string;
  /** ฐานของพื้น = เส้น 0 ถ้าแกนรวม 0 ไม่งั้นขอบล่างกราฟ */
  baseY: number;
  zeroY: number | null;
  top: number;
  bottom: number;
  /** สถานีที่มีป้ายตัวเลข (≥ 3 จุดและค่าไม่เท่ากันหมด · ค่าซ้ำเลือกเดือนหลังสุด) */
  min: Station | null;
  max: Station | null;
  /** ระยะ 1 เดือน (px) */
  step: number;
};

/** เรขาคณิตของกราฟขนาด width × height px — แกน x ตามเดือนจริง (เดือนที่ขาดเว้นช่องไว้) */
export function chartGeometry(points: TimelinePoint[], width: number, height = CHART_H): ChartGeometry {
  const first = monthIndex(points[0].period);
  const span = Math.max(1, monthIndex(points[points.length - 1].period) - first);
  const step = (width - PAD_X * 2) / span;
  const xs = points.map((p) => PAD_X + (monthIndex(p.period) - first) * step);
  const { lo, hi } = chartDomain(points.flatMap((p) => (p.value == null ? [] : [p.value])));
  const top = PLOT_TOP;
  const bottom = height - PLOT_BOTTOM;
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (bottom - top);
  const stations = points.flatMap((p, index) => (p.value == null ? [] : [{ index, x: xs[index], y: y(p.value), value: p.value }]));
  const zeroY = lo <= 0 && hi >= 0 ? y(0) : null;
  const baseY = zeroY ?? bottom;

  // ช่วงเส้นต่อเนื่อง = เดือนติดกันที่มีค่าทั้งคู่
  const runs: Station[][] = [];
  for (const s of stations) {
    const run = runs.at(-1);
    const prev = run?.at(-1);
    if (run && prev && monthIndex(points[s.index].period) === monthIndex(points[prev.index].period) + 1) run.push(s);
    else runs.push([s]);
  }
  const pt = (x: number, yy: number) => `${round(x)},${round(yy)}`;
  const line = runs.map((r) => r.map((s, i) => `${i ? "L" : "M"}${pt(s.x, s.y)}`).join("")).join("");
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `M${pt(r[0].x, baseY)}${r.map((s) => `L${pt(s.x, s.y)}`).join("")}L${pt(r[r.length - 1].x, baseY)}Z`)
    .join("");

  let max: Station | null = null;
  let min: Station | null = null;
  if (stations.length >= 3) {
    for (const s of stations) {
      if (!max || s.value >= max.value) max = s;
      if (!min || s.value <= min.value) min = s;
    }
    if (max && min && max.value === min.value) max = min = null;
  }
  return { xs, stations, line, area, baseY, zeroY, top, bottom, min, max, step };
}

export type Tick = { index: number; label: string };

/** ชื่อเดือนใต้กราฟ: เว้นระยะไม่ให้ชนกัน · ข้ามปีเติมปี พ.ศ. 2 หลัก · เดือนสุดท้ายแสดงเสมอ */
export function monthTicks(points: TimelinePoint[], xs: number[], step: number): Tick[] {
  const first = monthIndex(points[0].period);
  const last = points.length - 1;
  const multiYear = points[0].period.slice(0, 4) !== points[last].period.slice(0, 4);
  const minGap = multiYear ? 44 : 30;
  const every = Math.max(1, Math.ceil(minGap / step));
  const label = (p: string) => {
    const month = MONTHS_SHORT[Number(p.slice(5, 7)) - 1];
    return multiYear ? `${month} ${String(Number(p.slice(0, 4)) + 543).slice(-2)}` : month;
  };
  const ticks: Tick[] = [];
  points.forEach((p, index) => {
    if ((monthIndex(p.period) - first) % every === 0) ticks.push({ index, label: label(p.period) });
  });
  if (ticks.at(-1)?.index !== last) {
    while (ticks.length > 0 && xs[last] - xs[ticks[ticks.length - 1].index] < minGap) ticks.pop();
    ticks.push({ index: last, label: label(points[last].period) });
  }
  return ticks;
}

/** เดือนก่อนหน้าตามปฏิทิน (ถ้าอยู่ในช่วงและมีค่า) — ใช้เทียบเดือนต่อเดือน */
export function previousPoint(points: TimelinePoint[], index: number): TimelinePoint | null {
  const prev = points[index - 1];
  return prev && prev.value != null && monthIndex(prev.period) === monthIndex(points[index].period) - 1 ? prev : null;
}
