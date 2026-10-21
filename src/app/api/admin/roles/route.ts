import { asc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { rolePermissions, roles } from "@/backend/db/schema";
import { listResponse, requireApiPermission } from "@/backend/lib/admin-api";

// อ่านอย่างเดียว: บทบาทกำหนดจาก seed (ROLES ใน src/backend/lib/authz/scope.ts)
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;

  const [roleRows, links] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    db.select().from(rolePermissions),
  ]);
  const rows = roleRows.map((r) => ({
    ...r,
    permissions: links.filter((l) => l.roleId === r.id).map((l) => l.permissionCode),
  }));
  return listResponse(req, "roles", rows, ["code", "name"]);
}
