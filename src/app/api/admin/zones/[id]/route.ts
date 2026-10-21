import type { NextRequest } from "next/server";
import { apiError, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { putZone, removeZone, zoneRecords } from "@/backend/lib/master-data-api";

// แก้/ลบโซน (หน้า แก้ไขฐานข้อมูล) — รหัสโซนแก้ไม่ได้ · ลบได้เมื่อไม่มีหน่วยในโซนแล้ว

const codeOf = async (ctx: RouteContext<"/api/admin/zones/[id]">) => decodeURIComponent((await ctx.params).id);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/zones/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = await codeOf(ctx);
  const zone = (await zoneRecords(year)).find((z) => z.code === code);
  return zone ? Response.json(zone) : apiError(404, "ไม่พบโซน");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/zones/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return putZone(req, year, await codeOf(ctx));
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/zones/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return removeZone(year, await codeOf(ctx));
}
