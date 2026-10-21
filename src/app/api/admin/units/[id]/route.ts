import type { NextRequest } from "next/server";
import { apiError, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { unitListRows } from "@/backend/lib/admin-units";

// อ่านอย่างเดียว: ผังหน่วยกำหนดในโค้ด (src/backend/lib/master-import/units.ts) และถูกเขียนลงฐานข้อมูลตอนนำเข้า/seed

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/units/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  const unit = (await unitListRows(year)).find((u) => u.code === code);
  return unit ? Response.json(unit) : apiError(404, "ไม่พบหน่วย");
}
