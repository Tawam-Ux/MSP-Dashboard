import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { detectedGroupRows } from "@/backend/lib/admin-groups";

// หน้า "Group ใหม่" ในแอปหลังบ้าน: รหัส Group (คอลัมน์ A ของชีตงบ) ที่ไม่อยู่ใน Flow และยังไม่ได้เลือกหมวด
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  const pending = (await detectedGroupRows(year)).filter((g) => g.section === null);
  return listResponse(req, "pending-groups", pending, ["code", "name"]);
}
