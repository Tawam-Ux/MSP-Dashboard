import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { detectedRows } from "@/backend/lib/admin-units";
import { assignDetectedUnits } from "@/backend/lib/import-workbook";

// แก้หน่วยใหม่ทีละหน่วย (ฟอร์มในหน้า หน่วยงานใหม่): เลือกประเภท/โซน/หน่วยงาน/ชื่อ → หน่วยเข้าผังแล้วคำนวณงบใหม่ทันที
// เลือกหลายหน่วยพร้อมกันใช้ /api/admin/pending-units/bulk

const assignSchema = z.object({
  // ตรวจว่ามีประเภทนี้จริงใน assignDetectedUnits (ประเภทผู้ดูแลเพิ่มได้)
  category: z.string().trim().min(1, "เลือกประเภท"),
  zoneCode: z.string().trim().min(1, "เลือกโซน"),
  // "" / null = หน่วยงานเริ่มต้น
  orgCode: z.preprocess((v) => (v === "" ? null : v), z.string().trim().min(1).nullish()),
  name: z.string().trim().min(1, "ใส่ชื่อหน่วย").max(128).optional(),
});

async function record(year: number, code: string) {
  return (await detectedRows(year)).find((d) => d.code === code) ?? null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/pending-units/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const unit = await record(year, decodeURIComponent((await ctx.params).id));
  return unit ? Response.json(unit) : apiError(404, "ไม่พบหน่วย");
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/pending-units/[id]">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const code = decodeURIComponent((await ctx.params).id);
  if (!(await record(year, code))) return apiError(404, "ไม่พบหน่วย");

  const parsed = assignSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await assignDetectedUnits(db, year, [code], { ...parsed.data, orgCode: parsed.data.orgCode ?? undefined });
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json(await record(year, code));
}
