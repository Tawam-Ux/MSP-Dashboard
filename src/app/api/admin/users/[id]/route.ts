import type { NextRequest } from "next/server";
import { apiError, readJson, requireApiPermission } from "@/backend/lib/admin-api";
import { getAdminUser, updateUserSchema, updateUserWithAccess } from "@/backend/lib/users";

// ไม่มี DELETE: upload_logs อ้างถึงผู้ใช้ จึงใช้การปิดใช้งาน (isActive) แทนการลบ

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const user = await getAdminUser(Number((await ctx.params).id));
  return user ? Response.json(user) : apiError(404, "ไม่พบผู้ใช้");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const id = Number((await ctx.params).id);

  // react-admin ส่งทั้ง record มา; zod ตัดฟิลด์ที่แก้ไม่ได้ (username, authProvider, createdAt) ทิ้ง
  const parsed = updateUserSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const result = await updateUserWithAccess(me.id, id, parsed.data);
  if ("error" in result) return apiError(result.error === "ไม่พบผู้ใช้" ? 404 : 400, result.error);
  return Response.json(await getAdminUser(id));
}
