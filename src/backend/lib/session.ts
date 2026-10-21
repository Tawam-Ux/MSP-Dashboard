import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { rolePermissions, unitClosure, userRoles, users, userUnitScopes } from "@/backend/db/schema";
import { defaultUnit, hasPermission, resolveAllowedUnits, type ClosureRow, type Permission } from "./authz/scope";

export type CurrentUser = {
  id: number;
  name: string;
  username: string;
  permissions: Permission[];
  allowedUnits: Set<string>;
  defaultUnit: string | null;
  closure: ClosureRow[];
};

// โหลดสิทธิ์จากฐานข้อมูลทุก request เพื่อให้การเพิกถอนสิทธิ์มีผลทันที
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!id) return null;

  const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.isActive, true)));
  if (!user) return null;

  const [perms, scopes, closureRows] = await Promise.all([
    db
      .selectDistinct({ code: rolePermissions.permissionCode })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(eq(userRoles.userId, id)),
    db.select({ unitCode: userUnitScopes.unitCode }).from(userUnitScopes).where(eq(userUnitScopes.userId, id)),
    db.select({ ancestor: unitClosure.ancestor, descendant: unitClosure.descendant, depth: unitClosure.depth }).from(unitClosure),
  ]);
  // ผังแยกตามปี แต่สิทธิ์ผูกกับรหัสหน่วยร่วมกันทุกปี: เห็นหน่วยใต้หน่วยที่ได้รับสิทธิ์ในผังของปีใดก็ได้ (คู่ซ้ำข้ามปีเก็บแถวเดียว)
  const closure = [...new Map(closureRows.map((r) => [`${r.ancestor}>${r.descendant}`, r])).values()];

  const allowedUnits = resolveAllowedUnits(scopes.map((s) => s.unitCode), closure);
  return {
    id,
    name: user.name,
    username: user.username,
    permissions: perms.map((p) => p.code as Permission),
    allowedUnits,
    defaultUnit: defaultUnit(allowedUnits, closure),
    closure,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/");
  return user;
}
