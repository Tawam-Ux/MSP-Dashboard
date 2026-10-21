// สร้าง role, permission, ผังบัญชี, ผังหน่วย (ตามโค้ด) และบัญชี admin เริ่มต้น — รันซ้ำได้
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "@/backend/db";
import { permissions, rolePermissions, roles, userRoles, users, userUnitScopes } from "@/backend/db/schema";
import { PERMISSIONS, ROLES } from "@/backend/lib/authz/scope";
import { masterYears, recomputeStatements, syncAccounts, syncUnitTree } from "@/backend/lib/import-workbook";
import { ROOT_CODE as ROOT_UNIT } from "@/backend/lib/master-import/units";

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
  // ผังหน่วยกำหนดในโค้ด — แทนผังของทุกปีที่มีข้อมูลหลักแล้วคำนวณงบที่มีอยู่ใหม่ตามผังนี้
  // ยังไม่มีปีใดเลย (ติดตั้งใหม่) = สร้างข้อมูลหลักของปีปัจจุบันจากค่าเริ่มต้นในโค้ด
  const years = await masterYears(db);
  if (years.length === 0) years.push(new Date().getFullYear());
  for (const year of years) {
    await syncAccounts(db, year);
    const tree = await db.transaction(async (tx) => {
      const change = await syncUnitTree(tx, year);
      await recomputeStatements(tx, [year]);
      return change;
    });
    console.log(`ผังหน่วยปี ${year + 543}: เพิ่ม ${tree.added.length} · ลบ ${tree.removed.length} · แก้ ${tree.updated.length}`);
  }

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
