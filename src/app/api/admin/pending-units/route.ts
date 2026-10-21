import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { detectedRows } from "@/backend/lib/admin-units";

// หน้า "หน่วยงานใหม่" ในแอปหลังบ้าน: หน่วยที่ระบบตรวจพบในชีตงบ แต่ยังไม่ได้เลือกว่าเป็น Sales Zone หรือ Operations
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const pending = (await detectedRows(year)).filter((d) => d.category === null);
  return listResponse(req, "pending-units", pending, ["code", "name", "sheet", "zoneName"]);
}
