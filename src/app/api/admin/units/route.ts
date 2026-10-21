import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { unitListRows } from "@/backend/lib/admin-units";

// อ่านอย่างเดียว: ทุกหน่วยในผัง (ใช้เลือกสิทธิ์หน่วยในหน้าผู้ใช้) — ผังกำหนดในโค้ด + หน่วยใหม่ที่เลือกประเภทแล้ว
// react-admin ต้องการฟิลด์ id จึงใช้ code เป็น id
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "units", await unitListRows(year), ["code", "name", "zoneName", "zoneLabel"]);
}
