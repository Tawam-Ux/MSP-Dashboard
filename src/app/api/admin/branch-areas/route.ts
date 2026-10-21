import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { allBranchAreaRows } from "@/backend/lib/admin-branch-areas";
import { listResponse, requestYear, requireApiPermission } from "@/backend/lib/admin-api";

// หน้า "Branch Area" ในแอปหลังบ้าน: พื้นที่ ตร.ม. ของทุกสาขาขาย (ใช้คิดเกณฑ์รายได้ต่อ ตร.ม. ของ Sales Zone)
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;
  return listResponse(req, "branch-areas", await allBranchAreaRows(db, year), ["code", "name", "zone", "statusLabel"]);
}
