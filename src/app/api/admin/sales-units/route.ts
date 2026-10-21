import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { unitsOfPage } from "@/backend/lib/admin-units";

// หน้า "หน่วยงาน Sales Zone" ในแอปหลังบ้าน: หน่วยล่างสุดประเภท sales (อ่านอย่างเดียว)
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "sales-units", await unitsOfPage(year, "sales"), ["code", "name", "zoneName", "zoneLabel"]);
}
