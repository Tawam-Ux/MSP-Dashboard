import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { assignDetectedGroups } from "@/backend/lib/import-workbook";
import type { GroupSection } from "@/backend/lib/master-import/compute";

// เลือกหมวดให้ Group ใหม่หลายตัวพร้อมกัน (หน้า Group ใหม่) — คำนวณงบใหม่ครั้งเดียว
const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "เลือก Group อย่างน้อย 1 ตัว").max(1000),
  section: z.string().trim().min(1, "เลือกหมวด"),
});

export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const parsed = bulkSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await assignDetectedGroups(db, year, parsed.data.ids, parsed.data.section as GroupSection);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json({ updated: parsed.data.ids.length });
}
