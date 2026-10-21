import type { NextRequest } from "next/server";
import { apiError, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { categoryRecords } from "@/backend/lib/master-data-api";

// ประเภทหน่วยทีละรายการ (อ่านอย่างเดียว) — ไม่มีการแก้/ลบประเภทจากแอปหลังบ้าน
export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/categories/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  const category = (await categoryRecords(year)).find((c) => c.code === code);
  return category ? Response.json(category) : apiError(404, "ไม่พบประเภท");
}
