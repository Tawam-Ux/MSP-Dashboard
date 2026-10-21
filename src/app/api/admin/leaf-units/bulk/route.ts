import type { NextRequest } from "next/server";
import { requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { postLeafBulk } from "@/backend/lib/admin-units";

// แก้หลายหน่วยพร้อมกัน (ปุ่ม แก้ไข ในหน้า หน่วยงาน Sales Zone / Operations): { ids, changes: { orgCode?, zoneCode?, category? } }
// รวมเป็นคำขอเดียว: แทนผังและคำนวณงบใหม่ครั้งเดียว (ส่งทีละหน่วยพร้อมกันจะชนกันตอนแทนผัง)
export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return postLeafBulk(req, year);
}
