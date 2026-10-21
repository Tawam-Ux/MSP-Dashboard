import "server-only";
import { monthlyGroupTotals } from "@/backend/lib/reports";
import type { CurrentUser } from "@/backend/lib/session";
import type { PeriodPick } from "@/frontend/components/dash";
import { buildTimelines, isTimelineSpan, type KpiTimelines } from "./series";

/**
 * ข้อมูล Timeline ของการ์ด KPI — null เมื่องวดที่เลือกไม่ใช่ "ทั้งปี" / "ทุกเดือนที่มี" (การ์ดเป็นแบบเดิม)
 * usable = เดือนที่เลือกได้ในตัวเลือกงวด · unitCodes = หน่วยที่การ์ดรวมยอด (ชุดเดียวกับการ์ด ผลรวมรายเดือนจึงเท่ากับตัวเลขบนการ์ด)
 */
export async function loadKpiTimelines(user: CurrentUser, pick: PeriodPick, usable: string[], unitCodes: string[]): Promise<KpiTimelines | null> {
  if (!isTimelineSpan(pick.list, pick.all, usable)) return null;
  return buildTimelines(pick.list, await monthlyGroupTotals(user, unitCodes, pick.list));
}
