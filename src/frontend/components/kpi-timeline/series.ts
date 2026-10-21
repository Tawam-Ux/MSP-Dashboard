// ข้อมูลของกราฟ Timeline บนการ์ด KPI — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
import type { GroupTotals } from "@/backend/lib/reports";

export type TimelineMetric = "REV" | "EXP" | "GP" | "OP" | "PBT";

/** ทิศทางของตัวชี้วัด: รายได้ขึ้น = ดี · ต้นทุนขึ้น = แย่ · กำไร = ดู % ของรายได้ และติดลบ = ขาดทุน */
export type TimelineTone = "revenue" | "cost" | "profit";

/** หนึ่งเดือนบนกราฟ: value = ยอดของตัวชี้วัด · revenue = รายได้เดือนนั้น (คิด % ของรายได้) · ไม่มีงบเดือนนั้น = null */
export type TimelinePoint = { period: string; value: number | null; revenue: number | null };

export type KpiTimelines = Record<TimelineMetric, TimelinePoint[]>;

export const toneOf = (metric: TimelineMetric): TimelineTone => (metric === "REV" ? "revenue" : metric === "EXP" ? "cost" : "profit");

/**
 * Timeline แสดงเมื่อเลือก "ทุกเดือนที่มี" หรือ "ทั้งปี" = ครบทุกเดือนที่มีข้อมูลของปีเดียว (อย่างน้อย 2 เดือน)
 * usable = เดือนที่เลือกได้ในตัวเลือกงวด (หน้า Sales Zone เหลือเฉพาะเดือนที่สาขาที่กรองไว้มีข้อมูล)
 */
export function isTimelineSpan(list: string[], all: boolean, usable: string[]): boolean {
  if (list.length < 2) return false;
  if (all) return true;
  const year = list[0].slice(0, 4);
  if (list.some((p) => !p.startsWith(year))) return false;
  const inYear = new Set(usable.filter((p) => p.startsWith(year)));
  return inYear.size === list.length && list.every((p) => inYear.has(p));
}

const VALUE: Record<TimelineMetric, (t: GroupTotals) => number> = {
  REV: (t) => t.REV,
  // แบบเดียวกับการ์ดหน้า Operations: ต้นทุนขาย + SG&A + ค่าเสื่อม/ดอกเบี้ย (OP − PBT)
  EXP: (t) => t.TOTAL_COST + t.SGA + (t.OP - t.PBT),
  GP: (t) => t.GP,
  OP: (t) => t.OP,
  PBT: (t) => t.PBT,
};

/** ยอดรายเดือน (งวด → ยอดรวม) → จุดของทุกตัวชี้วัด เรียงตาม periods (เก่า → ใหม่) */
export function buildTimelines(periods: string[], monthly: Map<string, GroupTotals>): KpiTimelines {
  const series = (metric: TimelineMetric) =>
    periods.map((period): TimelinePoint => {
      const t = monthly.get(period);
      return { period, value: t ? VALUE[metric](t) : null, revenue: t ? t.REV : null };
    });
  return { REV: series("REV"), EXP: series("EXP"), GP: series("GP"), OP: series("OP"), PBT: series("PBT") };
}
