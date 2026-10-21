import type { NextRequest } from "next/server";
import { apiError, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { leafUnitRecord, putLeafUnit } from "@/backend/lib/admin-units";

// แก้หน่วยในหน้า "หน่วยงาน Operations": ชื่อ/โซน/ประเภท — ย้ายเป็น Sales Zone แล้วหน่วยไปอยู่อีกหน้า

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/operation-units/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const unit = await leafUnitRecord(year, decodeURIComponent((await ctx.params).id));
  return unit ? Response.json(unit) : apiError(404, "ไม่พบหน่วย");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/operation-units/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return putLeafUnit(req, year, decodeURIComponent((await ctx.params).id));
}
