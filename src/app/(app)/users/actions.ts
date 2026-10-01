"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, units, userRoles, users, userUnitScopes } from "@/db/schema";
import { requirePermission } from "@/lib/session";

export type UserFormState = { error?: string; ok?: string };

const createSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9._-]{3,64}$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3-64 ตัว"),
  name: z.string().trim().min(1, "ใส่ชื่อที่แสดง").max(128),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว"),
  roleCode: z.string().min(1, "เลือกบทบาท"),
  unitCodes: z.array(z.string()).min(1, "เลือกหน่วยที่ให้เห็นอย่างน้อย 1 หน่วย"),
});

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requirePermission("users.manage");
  const parsed = createSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    password: formData.get("password"),
    roleCode: formData.get("roleCode"),
    unitCodes: formData.getAll("unitCodes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username));
  if (taken) return { error: `มีชื่อผู้ใช้ "${input.username}" อยู่แล้ว` };
  const [role] = await db.select().from(roles).where(eq(roles.code, input.roleCode));
  if (!role) return { error: "ไม่พบบทบาทที่เลือก" };
  const known = new Set((await db.select({ code: units.code }).from(units)).map((u) => u.code));
  if (input.unitCodes.some((c) => !known.has(c))) return { error: "มีหน่วยที่เลือกไม่อยู่ในระบบ" };

  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.transaction(async (tx) => {
    const [res] = await tx.insert(users).values({ username: input.username, name: input.name, passwordHash });
    const userId = res.insertId;
    await tx.insert(userRoles).values({ userId, roleId: role.id });
    await tx.insert(userUnitScopes).values(input.unitCodes.map((unitCode) => ({ userId, unitCode })));
  });

  revalidatePath("/users");
  return { ok: `สร้างผู้ใช้ ${input.username} แล้ว` };
}

export async function setUserActive(formData: FormData) {
  const me = await requirePermission("users.manage");
  const userId = Number(formData.get("userId"));
  const active = formData.get("active") === "1";
  if (!userId || userId === me.id) return; // กันปิดบัญชีตัวเองจนไม่มีใครเข้าได้
  await db.update(users).set({ isActive: active }).where(and(eq(users.id, userId)));
  revalidatePath("/users");
}
