import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { assignDetectedUnits, setDetectedZones } from "@/backend/lib/import-workbook";

// หน่วยใหม่หลายหน่วยพร้อมกัน (หน้า หน่วยงานใหม่) ในคำขอเดียว:
// { ids, zoneCode } = ตั้งโซนอย่างเดียว (ยังรอเลือกประเภท) · { ids, category } = เลือกประเภท ใช้โซนของแต่ละหน่วย
const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "เลือกหน่วยอย่างน้อย 1 หน่วย").max(1000),
  zoneCode: z.string().min(1).optional(),
  category: z.string().trim().min(1).optional(),
}).refine((b) => b.zoneCode || b.category, "เลือกโซนหรือประเภท");

export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const parsed = bulkSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const { ids, zoneCode, category } = parsed.data;
  try {
    if (category) await assignDetectedUnits(db, year, ids, { category, zoneCode });
    else await setDetectedZones(db, year, ids, zoneCode!);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json({ updated: ids.length });
}
