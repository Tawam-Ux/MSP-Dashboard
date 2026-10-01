import {
  boolean, date, decimal, index, int, mysqlTable, primaryKey, timestamp, tinyint, uniqueIndex, varchar,
} from "drizzle-orm/mysql-core";

// ---------- ข้อมูลการเงิน ----------

export const units = mysqlTable("units", {
  code: varchar("code", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  parentCode: varchar("parent_code", { length: 32 }),
  level: tinyint("level").notNull(),
  sortOrder: int("sort_order").notNull(),
}, (t) => [index("units_parent_idx").on(t.parentCode)]);

/** ทุกคู่ (หน่วยแม่, หน่วยลูกหลาน) รวมตัวเอง ใช้กรองข้อมูลตามลำดับชั้นด้วย join เดียว */
export const unitClosure = mysqlTable("unit_closure", {
  ancestor: varchar("ancestor", { length: 32 }).notNull(),
  descendant: varchar("descendant", { length: 32 }).notNull(),
  depth: tinyint("depth").notNull(),
}, (t) => [primaryKey({ columns: [t.ancestor, t.descendant] }), index("closure_descendant_idx").on(t.descendant)]);

export const accounts = mysqlTable("accounts", {
  code: varchar("code", { length: 16 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  section: varchar("section", { length: 32 }).notNull(),
  sortOrder: int("sort_order").notNull(),
});

/** เก็บเฉพาะหน่วยล่างสุด ยอดของหน่วยแม่คำนวณผ่าน unit_closure */
export const facts = mysqlTable("facts", {
  period: date("period", { mode: "string" }).notNull(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
  accountCode: varchar("account_code", { length: 16 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
}, (t) => [primaryKey({ columns: [t.period, t.unitCode, t.accountCode] }), index("facts_unit_idx").on(t.unitCode)]);

// ---------- ผู้ใช้และสิทธิ์ ----------

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  passwordHash: varchar("password_hash", { length: 100 }),
  // 'local' = ล็อกอินด้วยรหัสผ่านของระบบนี้, ค่าอื่น = ผู้ให้บริการ SSO (เช่น เว็บหลัก)
  authProvider: varchar("auth_provider", { length: 32 }).notNull().default("local"),
  externalId: varchar("external_id", { length: 128 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_external_idx").on(t.authProvider, t.externalId)]);

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
});

export const permissions = mysqlTable("permissions", {
  code: varchar("code", { length: 64 }).primaryKey(),
  description: varchar("description", { length: 128 }).notNull(),
});

export const rolePermissions = mysqlTable("role_permissions", {
  roleId: int("role_id").notNull(),
  permissionCode: varchar("permission_code", { length: 64 }).notNull(),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })]);

export const userRoles = mysqlTable("user_roles", {
  userId: int("user_id").notNull(),
  roleId: int("role_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] })]);

/** หน่วยที่ผู้ใช้ได้รับสิทธิ์ (สืบทอดลงไปถึงหน่วยลูกทั้งหมด) */
export const userUnitScopes = mysqlTable("user_unit_scopes", {
  userId: int("user_id").notNull(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.unitCode] })]);

export const uploadLogs = mysqlTable("upload_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  period: date("period", { mode: "string" }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  factCount: int("fact_count").notNull(),
  mismatchCount: int("mismatch_count").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
