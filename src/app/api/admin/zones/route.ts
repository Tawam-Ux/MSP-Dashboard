import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { postZone, zoneRecords } from "@/backend/lib/master-data-api";

// โซน (ตาราง zones): ตัวเลือกโซนในฟอร์มหน่วย + หน้า แก้ไขฐานข้อมูล (เพิ่มโซน)
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "zones", await zoneRecords(year), ["code", "name", "label", "sheetPrefix"]);
}

export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return postZone(req, year);
}
