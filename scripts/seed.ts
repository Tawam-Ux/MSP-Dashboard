// สร้าง role, permission, ผังบัญชี และบัญชี admin เริ่มต้น — รันซ้ำได้
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { permissions, rolePermissions, roles, userRoles, users, userUnitScopes } from "@/db/schema";
import { PERMISSIONS, ROLES } from "@/lib/authz/scope";
import { syncAccounts } from "@/lib/import-workbook";

const ROOT_UNIT = "MSP";

async function main() {
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await db.insert(permissions).values({ code, description }).onDuplicateKeyUpdate({ set: { description } });
  }
  for (const r of ROLES) {
    await db.insert(roles).values({ code: r.code, name: r.name }).onDuplicateKeyUpdate({ set: { name: r.name } });
    const [role] = await db.select().from(roles).where(eq(roles.code, r.code));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await db.insert(rolePermissions).values(r.permissions.map((p) => ({ roleId: role.id, permissionCode: p })));
  }
  await syncAccounts(db);

  const [existing] = await db.select().from(users).where(eq(users.username, "admin"));
  if (existing) {
    console.log("มีบัญชี admin อยู่แล้ว — ไม่เปลี่ยนรหัสผ่าน");
  } else {
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password === "change-me") throw new Error("ตั้งค่า ADMIN_PASSWORD ในไฟล์ .env ก่อน");
    await db.insert(users).values({ username: "admin", name: "ผู้ดูแลระบบ", passwordHash: await bcrypt.hash(password, 12) });
    const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
    const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin"));
    await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id });
    await db.insert(userUnitScopes).values({ userId: admin.id, unitCode: ROOT_UNIT });
    console.log("สร้างบัญชี admin แล้ว");
  }
  console.log(`seed เสร็จ: ${ROLES.length} roles, ${Object.keys(PERMISSIONS).length} permissions`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
