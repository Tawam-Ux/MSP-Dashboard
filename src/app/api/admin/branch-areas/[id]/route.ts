import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { allBranchAreaRows, setBranchArea } from "@/backend/lib/admin-branch-areas";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";

// แก้พื้นที่ ตร.ม. ของสาขา (หน้า Branch Area) — บันทึกแล้วเกณฑ์รายได้ต่อ ตร.ม. ทุกงวดคำนวณใหม่ทันที
// ไฟล์ Master ถัดไปที่มีชีต Branch_Area เขียนทับค่าที่แก้ในหน้านี้

const updateSchema = z.object({
  // react-admin ส่งช่องว่างมาเป็น null = ลบข้อมูล ตร.ม. ของสาขานี้
  areaSqm: z.coerce.number().positive("พื้นที่ต้องมากกว่า 0").max(1_000_000, "พื้นที่มากเกินไป").nullable(),
});

async function record(year: number, code: string) {
  return (await allBranchAreaRows(db, year)).find((r) => r.code === code) ?? null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/branch-areas/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const row = await record(year, decodeURIComponent((await ctx.params).id));
  return row ? Response.json(row) : apiError(404, "ไม่พบสาขา");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/branch-areas/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  const current = await record(year, code);
  if (!current) return apiError(404, "ไม่พบสาขา");

  const body = (await readJson(req)) as { areaSqm?: unknown } | null;
  const parsed = updateSchema.safeParse({ areaSqm: body?.areaSqm === "" || body?.areaSqm === undefined ? null : body.areaSqm });
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await setBranchArea(db, year, code, current.name, parsed.data.areaSqm);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json(await record(year, code));
}
