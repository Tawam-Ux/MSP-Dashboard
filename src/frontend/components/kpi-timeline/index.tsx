// Timeline บนการ์ด KPI (หน้า Sales Zone / Operations): เลือกงวด "ทั้งปี" หรือ "ทุกเดือนที่มี" แล้วชี้การ์ดยอดเงิน
// → การ์ดขยาย (ExpandCard แบบ Microsoft Store) พร้อมกราฟเส้นรายเดือนของตัวชี้วัดนั้น
// ถอดฟีเจอร์ออกทั้งชุด: ลบโฟลเดอร์นี้ · ลบ monthlyGroupTotals ใน src/backend/lib/reports.ts
// · ใน src/app/(app)/zones/page.tsx และ src/app/(app)/operations/page.tsx คืน <TimelineKpi> เป็น <MoneyKpi> และลบบรรทัด loadKpiTimelines
// (src/frontend/components/expand-card ไม่ต้องลบ — การ์ด Nope ใน Branch Ranking ใช้อยู่)
import { MoneyKpi, type LineKey } from "@/frontend/components/dash";
import { KpiTimeline } from "./kpi-timeline";
import { toneOf, type KpiTimelines, type TimelineMetric } from "./series";

export { loadKpiTimelines } from "./data";

/** การ์ด KPI ยอดเงิน + Timeline ของตัวชี้วัด metric — ไม่มีข้อมูลรายเดือน = การ์ดเดิมทุกอย่าง */
export function TimelineKpi({ timelines, metric, ...kpi }: {
  timelines: KpiTimelines | null;
  metric: TimelineMetric;
  label: string;
  value: number;
  line: LineKey;
  code: string;
  note?: React.ReactNode;
}) {
  const tile = <MoneyKpi {...kpi} />;
  const points = timelines?.[metric];
  if (!points?.some((p) => p.value != null)) return tile;
  return (
    <KpiTimeline points={points} tone={toneOf(metric)} label={kpi.label} value={kpi.value} line={kpi.line} code={kpi.code}>
      {tile}
    </KpiTimeline>
  );
}
