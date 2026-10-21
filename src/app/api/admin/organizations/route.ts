import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, listResponse, readJson, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { createOrganization } from "@/backend/lib/import-workbook";
import { orgCodeSchema, orgRecords } from "@/backend/lib/master-data-api";

// หน่วยงาน (บริษัท): หน่วยงานเริ่มต้นกำหนดในโค้ด + ที่ผู้ดูแลเพิ่ม — ใช้เป็นตัวเลือกตอนแก้หน่วย

export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "organizations", await orgRecords(year), ["code", "name"]);
}

const createSchema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อหน่วยงาน").max(128),
  // ว่าง = ระบบตั้งรหัสให้
  code: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), orgCodeSchema.optional()),
});

export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    const org = await createOrganization(db, year, parsed.data.name, parsed.data.code);
    return Response.json((await orgRecords(year)).find((o) => o.code === org.code));
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
}
