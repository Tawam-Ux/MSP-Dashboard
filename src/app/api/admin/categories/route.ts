import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { categoryRecords } from "@/backend/lib/master-data-api";

// ประเภทหน่วย (ตาราง unit_categories) อ่านอย่างเดียว: ตัวเลือกประเภทในฟอร์มหน่วยของแอปหลังบ้าน
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "categories", await categoryRecords(year), ["code", "prefix", "name"]);
}
