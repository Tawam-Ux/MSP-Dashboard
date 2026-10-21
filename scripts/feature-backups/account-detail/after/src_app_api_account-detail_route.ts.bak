import type { NextRequest } from "next/server";
import { apiError, requireApiPermission } from "@/backend/lib/admin-api";
import { ACCOUNT_DETAIL_ENABLED, AccountDetailError, getAccountDetail } from "@/backend/lib/account-detail";

// รายละเอียดรายการในงบ: GET ?unit=CM-101&group=A&periods=2026-08-01,2026-07-01
// ข้อมูลจากชีต MASTER_<เดือน> ของไฟล์ Master ที่ใช้อยู่ — ดู src/backend/lib/account-detail.ts

const PERIOD = /^\d{4}-\d{2}-01$/;

export async function GET(req: NextRequest) {
  if (!ACCOUNT_DETAIL_ENABLED) return apiError(404, "ปิดฟีเจอร์นี้อยู่");
  const me = await requireApiPermission("dashboard.view");
  if (me instanceof Response) return me;

  const q = req.nextUrl.searchParams;
  const unit = q.get("unit")?.trim() ?? "";
  const group = q.get("group")?.trim() ?? "";
  const periods = (q.get("periods") ?? "").split(",").filter((p) => PERIOD.test(p));
  if (!unit || !group || periods.length === 0) return apiError(400, "ต้องระบุ unit, group และ periods");

  try {
    const detail = await getAccountDetail(me, unit, group, periods);
    return Response.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof AccountDetailError) return apiError(e.message.startsWith("ไม่มีสิทธิ์") ? 403 : 404, e.message);
    throw e;
  }
}
