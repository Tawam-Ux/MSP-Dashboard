import type { NextRequest } from "next/server";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { allGroupRows } from "@/backend/lib/admin-groups";

// หน้า "Group" ในแอปหลังบ้าน: ทุก Group (คอลัมน์ A ของชีตงบ) พร้อมหมวด ผลต่อยอดรวม และยอดในข้อมูลปัจจุบัน
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "groups", await allGroupRows(year), ["code", "name", "sectionLabel", "effect"]);
}
