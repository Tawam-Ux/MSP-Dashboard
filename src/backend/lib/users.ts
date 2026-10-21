import "server-only";
import bcrypt from "bcryptjs";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db";
import { rolePermissions, roles, units, userRoles, users, userUnitScopes } from "@/backend/db/schema";

// ตรรกะจัดการผู้ใช้ของ API /api/admin/users (แอปหลังบ้าน admin-app/ เรียกใช้)

export const usernameSchema = z
  .string()
  .trim()
  // เก็บเป็นตัวพิมพ์เล็กเสมอ ให้ล็อกอินได้โดยไม่ต้องสนใจตัวพิมพ์ใหญ่/เล็ก
  .toLowerCase()
  .regex(/^[\p{L}\p{M}\p{N}._@-]{3,64}$/u, "ชื่อผู้ใช้ต้องยาว 3-64 ตัว ใช้ตัวอักษร (ไทย/อังกฤษ) ตัวเลข และ . _ - @ ได้ ห้ามมีช่องว่าง");
export const displayNameSchema = z.string().trim().min(1, "ใส่ชื่อที่แสดง").max(128);
export const passwordSchema = z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว");
const roleIdsSchema = z.array(z.coerce.number().int().positive()).min(1, "เลือกบทบาทอย่างน้อย 1 บทบาท");
const unitCodesSchema = z.array(z.string()).min(1, "เลือกหน่วยที่ให้เห็นอย่างน้อย 1 หน่วย");

export const createUserSchema = z.object({
  username: usernameSchema,
  name: displayNameSchema,
  password: passwordSchema,
  roleIds: roleIdsSchema,
  unitCodes: unitCodesSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: displayNameSchema.optional(),
  // ว่าง = ไม่เปลี่ยนรหัสผ่าน
  password: z.union([z.literal(""), passwordSchema]).nullish(),
  isActive: z.boolean().optional(),
  roleIds: roleIdsSchema.optional(),
  unitCodes: unitCodesSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type AdminUser = {
  id: number;
  username: string;
  name: string;
  authProvider: string;
  isActive: boolean;
  createdAt: string;
  roleIds: number[];
  unitCodes: string[];
};

type Fail = { error: string };

/** ผู้ใช้พร้อมบทบาทและหน่วยที่เห็น — ไม่ส่ง passwordHash ออกไป */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const [userRows, roleLinks, scopeLinks] = await Promise.all([
    db.select().from(users).orderBy(asc(users.username)),
    db.select().from(userRoles),
    db.select().from(userUnitScopes),
  ]);
  return userRows.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    authProvider: u.authProvider,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    roleIds: roleLinks.filter((r) => r.userId === u.id).map((r) => r.roleId),
    unitCodes: scopeLinks.filter((s) => s.userId === u.id).map((s) => s.unitCode),
  }));
}

export async function getAdminUser(id: number): Promise<AdminUser | null> {
  return (await listAdminUsers()).find((u) => u.id === id) ?? null;
}

async function checkAccess(roleIds: number[] | undefined, unitCodes: string[] | undefined): Promise<Fail | null> {
  if (roleIds) {
    const found = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds));
    if (found.length !== new Set(roleIds).size) return { error: "ไม่พบบทบาทที่เลือก" };
  }
  if (unitCodes) {
    const known = new Set((await db.select({ code: units.code }).from(units)).map((u) => u.code));
    if (unitCodes.some((c) => !known.has(c))) return { error: "มีหน่วยที่เลือกไม่อยู่ในระบบ" };
  }
  return null;
}

export async function createUserWithAccess(input: CreateUserInput): Promise<{ id: number } | Fail> {
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username));
  if (taken) return { error: `มีชื่อผู้ใช้ "${input.username}" อยู่แล้ว` };
  const invalid = await checkAccess(input.roleIds, input.unitCodes);
  if (invalid) return invalid;

  const passwordHash = await bcrypt.hash(input.password, 12);
  const id = await db.transaction(async (tx) => {
    const [res] = await tx.insert(users).values({ username: input.username, name: input.name, passwordHash });
    const userId = res.insertId;
    await tx.insert(userRoles).values([...new Set(input.roleIds)].map((roleId) => ({ userId, roleId })));
    await tx.insert(userUnitScopes).values([...new Set(input.unitCodes)].map((unitCode) => ({ userId, unitCode })));
    return userId;
  });
  return { id };
}

/** meId = ผู้ที่กำลังแก้ไข ใช้กันไม่ให้ตัดสิทธิ์ตัวเองจนไม่มีใครเข้าหน้าจัดการได้ */
export async function updateUserWithAccess(meId: number, id: number, input: UpdateUserInput): Promise<{ id: number } | Fail> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return { error: "ไม่พบผู้ใช้" };

  if (id === meId) {
    if (input.isActive === false) return { error: "ปิดใช้งานบัญชีของตัวเองไม่ได้" };
    if (input.roleIds) {
      const perms = await db
        .select({ code: rolePermissions.permissionCode })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, input.roleIds));
      if (!perms.some((p) => p.code === "users.manage")) return { error: "ถอดสิทธิ์จัดการผู้ใช้ออกจากบัญชีของตัวเองไม่ได้" };
    }
  }
  if (input.password && user.authProvider !== "local") return { error: "ผู้ใช้ที่ล็อกอินผ่าน SSO ตั้งรหัสผ่านในระบบนี้ไม่ได้" };
  const invalid = await checkAccess(input.roleIds, input.unitCodes);
  if (invalid) return invalid;

  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  await db.transaction(async (tx) => {
    const fields = { name: input.name, isActive: input.isActive, passwordHash };
    if (Object.values(fields).some((v) => v !== undefined)) await tx.update(users).set(fields).where(eq(users.id, id));
    if (input.roleIds) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx.insert(userRoles).values([...new Set(input.roleIds)].map((roleId) => ({ userId: id, roleId })));
    }
    if (input.unitCodes) {
      await tx.delete(userUnitScopes).where(eq(userUnitScopes.userId, id));
      await tx.insert(userUnitScopes).values([...new Set(input.unitCodes)].map((unitCode) => ({ userId: id, unitCode })));
    }
  });
  return { id };
}
