import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { allGroupRows } from "@/backend/lib/admin-groups";
import { updateGroup } from "@/backend/lib/import-workbook";
import type { GroupSection } from "@/backend/lib/master-import/compute";

// แก้ Group ย้อนหลัง (หน้า Group): Group ใน Flow แก้ชื่อได้อย่างเดียว · Group ใหม่แก้ชื่อและหมวดได้ ("pending" = กลับไปรอเลือก ไม่นับในงบ)
// บันทึกแล้วงบทุกงวดคำนวณใหม่จากยอดที่เก็บไว้

const updateSchema = z.object({
  // ชื่อว่างของ Group ใน Flow = กลับไปใช้ชื่อตามไฟล์
  // react-admin ส่งช่องว่างมาเป็น null
  name: z.string().trim().max(128).nullish().transform((v) => (v === null ? "" : v)),
  section: z.string().trim().min(1).optional(),
});

async function record(year: number, code: string) {
  return (await allGroupRows(year)).find((g) => g.code === code) ?? null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/groups/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const group = await record(year, decodeURIComponent((await ctx.params).id));
  return group ? Response.json({ ...group, section: group.section ?? "pending" }) : apiError(404, "ไม่พบ Group");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/groups/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  const current = await record(year, code);
  if (!current) return apiError(404, "ไม่พบ Group");

  const parsed = updateSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const { name, section } = parsed.data;
  if (current.source === "new" && name === "") return apiError(400, "ใส่ชื่อรายการ");
  try {
    await updateGroup(db, year, code, {
      name,
      // Group ใน Flow: ฟอร์มส่งหมวดเดิมกลับมา — ไม่นับว่าเปลี่ยน
      section: current.source === "flow" ? undefined : section === undefined ? undefined : section === "pending" ? null : (section as GroupSection),
    });
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  const updated = await record(year, code);
  return Response.json(updated ? { ...updated, section: updated.section ?? "pending" } : null);
}
