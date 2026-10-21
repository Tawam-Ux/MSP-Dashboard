import type { NextRequest } from "next/server";
import { apiError, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { orgRecords, putOrg, removeOrg } from "@/backend/lib/master-data-api";

// แก้ชื่อ/ลบหน่วยงาน (หน้า แก้ไขฐานข้อมูล) — หน่วยงานเริ่มต้นแก้ชื่อได้แต่ลบไม่ได้

const codeOf = async (ctx: RouteContext<"/api/admin/organizations/[id]">) => decodeURIComponent((await ctx.params).id);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/organizations/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = await codeOf(ctx);
  const org = (await orgRecords(year)).find((o) => o.code === code);
  return org ? Response.json(org) : apiError(404, "ไม่พบหน่วยงาน");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/organizations/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return putOrg(req, year, await codeOf(ctx));
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/organizations/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return removeOrg(year, await codeOf(ctx));
}
