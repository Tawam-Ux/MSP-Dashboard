import type { NextRequest } from "next/server";
import { requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { postLeafDelete } from "@/backend/lib/admin-units";

// ลบหลายหน่วยออกจากผังพร้อมกัน (ปุ่ม ลบ ในโหมดแก้ไขของหน้า หน่วยงาน Sales Zone / Operations): { ids }
export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return postLeafDelete(req, year);
}
