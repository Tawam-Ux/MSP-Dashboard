import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { detectedGroupRows } from "@/backend/lib/admin-groups";
import { assignDetectedGroups } from "@/backend/lib/import-workbook";
import type { GroupSection } from "@/backend/lib/master-import/compute";

// แก้ Group ใหม่ทีละตัว (ฟอร์มในหน้า Group ใหม่): เลือกหมวด/ชื่อ → นับในงบแล้วคำนวณงบใหม่ทันที
// เลือกหลายตัวพร้อมกันใช้ /api/admin/pending-groups/bulk

const assignSchema = z.object({
  // ตรวจว่าเป็นหมวดที่เลือกได้ใน assignDetectedGroups
  section: z.string().trim().min(1, "เลือกหมวด"),
  name: z.string().trim().min(1, "ใส่ชื่อรายการ").max(128).optional(),
});

async function record(year: number, code: string) {
  return (await detectedGroupRows(year)).find((g) => g.code === code) ?? null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/pending-groups/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const group = await record(year, decodeURIComponent((await ctx.params).id));
  return group ? Response.json(group) : apiError(404, "ไม่พบ Group");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/pending-groups/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  if (!(await record(year, code))) return apiError(404, "ไม่พบ Group");

  const parsed = assignSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await assignDetectedGroups(db, year, [code], parsed.data.section as GroupSection, parsed.data.name);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json(await record(year, code));
}
