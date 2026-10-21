import {
  boolean, date, decimal, index, int, mysqlTable, primaryKey, smallint, timestamp, tinyint, uniqueIndex, varchar,
} from "drizzle-orm/mysql-core";
import type { GroupSection } from "../lib/master-import/compute";
import type { LineKind, TotalKey } from "../lib/statement";

// ---------- ข้อมูลการเงิน ----------

/** หน้า Dashboard ที่หน่วยล่างสุดไปแสดง: sales = Sales Zone (ใต้หน่วยแม่ของตัวเอง), operations = Operations */
export type UnitPage = "sales" | "operations";
/** รหัสประเภทหน่วย (ตาราง unit_categories) — ค่าเริ่มต้น sales / operations ผู้ดูแลเพิ่มประเภทอื่นได้ แต่ละประเภทเลือกหน้าที่แสดง */
export type UnitCategory = string;

// ข้อมูลหลัก (ผังหน่วย โซน หน่วยงาน ประเภท หน่วย/Group ใหม่ ตร.ม.) แยกตามปี: คอลัมน์ year = ปี ค.ศ. ของข้อมูล
// งบของงวดหนึ่งคำนวณด้วยข้อมูลหลักของปีงวดนั้น · ปีใหม่เริ่มจากสำเนาของปีก่อนหน้า (ดู ensureYear ใน lib/import-workbook.ts)
const year = () => smallint("year").notNull();

export const units = mysqlTable("units", {
  year: year(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  parentCode: varchar("parent_code", { length: 32 }),
  level: tinyint("level").notNull(),
  sortOrder: int("sort_order").notNull(),
  /** หน่วยล่างสุด: หน้าที่แสดง (ตามประเภทของหน่วย) · หน่วยกลุ่ม = null */
  category: varchar("category", { length: 16 }).$type<UnitPage>(),
}, (t) => [primaryKey({ columns: [t.year, t.code] }), index("units_parent_idx").on(t.year, t.parentCode)]);

/**
 * โซน — ค่าเริ่มต้น (Zone-CMI / NAN / SU) มาจากโค้ด master-import/units.ts ใส่ลงตารางนี้อัตโนมัติครั้งแรก
 * ผู้ดูแลเพิ่ม/แก้/ลบได้ในหน้า แก้ไขฐานข้อมูล · ลบ = removed (แถวยังอยู่ ไม่ให้ค่าเริ่มต้นถูกใส่กลับ)
 */
export const zones = mysqlTable("zones", {
  year: year(),
  code: varchar("code", { length: 32 }).notNull(),
  /** รหัสโซนที่ตัด "Zone-" ออก ใช้ประกอบรหัสกลุ่มในผัง เช่น Sz-CMI · ห้ามซ้ำ (ตามรหัสโซนเมื่อแก้รหัส) */
  key: varchar("key", { length: 16 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  /** ความหมายภาษาไทย เช่น โซนเชียงใหม่ */
  // (รหัสโซน code แก้ได้ในหน้า แก้ไขฐานข้อมูล — ระบบย้ายค่าที่อ้างรหัสเดิมตามให้ ดู lib/master-data.ts)
  label: varchar("label", { length: 128 }).notNull(),
  /** ชื่อชีตงบภูมิภาค (ก่อน _เดือน) — หน่วยใหม่ที่พบในชีตนี้ถือว่าอยู่โซนนี้ · null = ไม่มีชีตของตัวเอง */
  sheetPrefix: varchar("sheet_prefix", { length: 64 }),
  sortOrder: int("sort_order").notNull(),
  removed: boolean("removed").notNull().default(false),
  /** รหัสเดิมตามโค้ด (โซนเริ่มต้น) — หน่วยในโค้ดอ้างรหัสนี้ จึงยังหาโซนเจอแม้ผู้ดูแลเปลี่ยนรหัสโซนแล้ว · โซนที่ผู้ดูแลเพิ่ม = null */
  baseCode: varchar("base_code", { length: 32 }),
}, (t) => [primaryKey({ columns: [t.year, t.code] }), uniqueIndex("zones_key_idx").on(t.year, t.key)]);

/**
 * ประเภทหน่วย — ค่าเริ่มต้น sales (Sz) / operations (Op) มาจากโค้ด แก้ชื่อได้แต่ลบไม่ได้
 * ประเภทที่ผู้ดูแลเพิ่มมีกลุ่มของตัวเองในผัง (<prefix>-<โซน>) และแสดงในหน้า Dashboard ตาม page
 */
export const unitCategories = mysqlTable("unit_categories", {
  year: year(),
  code: varchar("code", { length: 16 }).notNull(),
  /** รหัสย่อของกลุ่มในผัง เช่น Sz → Sz-CMI · ห้ามซ้ำ · แก้ได้ (code คงเดิม เป็นรหัสภายใน) */
  prefix: varchar("prefix", { length: 8 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  page: varchar("page", { length: 16 }).$type<UnitPage>().notNull(),
  sortOrder: int("sort_order").notNull(),
}, (t) => [primaryKey({ columns: [t.year, t.code] }), uniqueIndex("unit_categories_prefix_idx").on(t.year, t.prefix)]);

/**
 * หน่วยที่ระบบตรวจพบในชีตงบแต่ไม่อยู่ในผังที่กำหนดในโค้ด (src/backend/lib/master-import/units.ts)
 * category null = รอผู้ดูแลเลือกว่าเป็น Sales Zone หรือ Operations — ระหว่างนี้ยังไม่นับในงบ (ยอดเก็บไว้ใน group_amounts แล้ว)
 * เลือกแล้ว → หน่วยเข้าผังใต้ Sz-/Op- ของโซน (zone_code) ทุกครั้งที่แทนผัง
 */
/**
 * หน่วยงาน (บริษัท) ที่ผู้ดูแลเพิ่มเอง — หน่วยงานเริ่มต้น (MSP Interfood) กำหนดในโค้ด
 * ถ้ามีแถวรหัสเดียวกับหน่วยงานเริ่มต้น = ชื่อที่ผู้ดูแลแก้ทับ
 * ผัง: MSP (รวมทุกหน่วยงาน) → หน่วยงาน → Zone → Op/Sz → หน่วย
 */
export const organizations = mysqlTable("organizations", {
  year: year(),
  code: varchar("code", { length: 10 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.year, t.code] })]);

export const detectedUnits = mysqlTable("detected_units", {
  year: year(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  /** หน่วยงาน · null = หน่วยงานเริ่มต้น */
  orgCode: varchar("org_code", { length: 10 }),
  /** โซนที่เดาจากชีตที่พบ (เช่นชีตน่าน → Zone-NAN) · null = พบในชีตงบรวม ต้องเลือกโซนเอง */
  zoneCode: varchar("zone_code", { length: 32 }),
  sheet: varchar("sheet", { length: 64 }).notNull(),
  category: varchar("category", { length: 16 }).$type<UnitCategory>(),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
}, (t) => [primaryKey({ columns: [t.year, t.code] })]);

/**
 * ค่าที่ผู้ดูแลแก้ทับหน่วยในผังที่กำหนดในโค้ด (หน้า หน่วยงาน Sales Zone / Operations ในแอปหลังบ้าน)
 * null = ใช้ค่าตามโค้ด · ใช้ทุกครั้งที่แทนผัง จึงไม่หายตอนนำเข้าไฟล์/seed (หน่วยใหม่จากไฟล์แก้ที่ detected_units แทน)
 */
export const unitOverrides = mysqlTable("unit_overrides", {
  year: year(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }),
  orgCode: varchar("org_code", { length: 10 }),
  zoneCode: varchar("zone_code", { length: 32 }),
  category: varchar("category", { length: 16 }).$type<UnitCategory>(),
  /** ผู้ดูแลลบหน่วยนี้ออกจากผัง (ไม่นับในงบ) — นำเข้าไฟล์ครั้งถัดไปแล้วยังมียอด จะไปรอที่หน้า หน่วยงานใหม่ ให้เลือกคืน */
  removed: boolean("removed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.year, t.code] })]);

/** ทุกคู่ (หน่วยแม่, หน่วยลูกหลาน) รวมตัวเอง ของผังแต่ละปี ใช้กรองข้อมูลตามลำดับชั้นด้วย join เดียว */
export const unitClosure = mysqlTable("unit_closure", {
  year: year(),
  ancestor: varchar("ancestor", { length: 32 }).notNull(),
  descendant: varchar("descendant", { length: 32 }).notNull(),
  depth: tinyint("depth").notNull(),
}, (t) => [primaryKey({ columns: [t.year, t.ancestor, t.descendant] }), index("closure_descendant_idx").on(t.year, t.descendant)]);

/**
 * Group ใหม่ในคอลัมน์ A ของชีตงบที่ไม่อยู่ใน Flow ในโค้ด (master-import/compute.ts) — ผู้ดูแลเลือกหมวดในแอปหลังบ้าน (หน้า Group ใหม่)
 * section null = รอเลือก (ยอดเก็บใน group_amounts แล้วแต่ยังไม่นับในงบ) · เลือกแล้ว = มีแถวในงบท้ายหมวดนั้น
 */
export const detectedGroups = mysqlTable("detected_groups", {
  year: year(),
  code: varchar("code", { length: 16 }).notNull(),
  /** ชื่อรายการในคอลัมน์ B */
  name: varchar("name", { length: 128 }).notNull(),
  section: varchar("section", { length: 32 }).$type<GroupSection>(),
  /** ยอดรวมทุกหน่วยทุกเดือนในไฟล์ล่าสุดที่พบ (ไว้ให้ผู้ดูแลดูประกอบการเลือก) */
  fileAmount: decimal("file_amount", { precision: 22, scale: 2 }).notNull().default("0"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
}, (t) => [primaryKey({ columns: [t.year, t.code] })]);

/** ชื่อที่ผู้ดูแลแก้ทับชื่อบัญชีของ Group ใน Flow (หน้า Group ในแอปหลังบ้าน) — หมวดของ Group ใน Flow แก้ไม่ได้ */
export const groupNames = mysqlTable("group_names", {
  year: year(),
  code: varchar("code", { length: 16 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
}, (t) => [primaryKey({ columns: [t.year, t.code] })]);

export const accounts = mysqlTable("accounts", {
  code: varchar("code", { length: 16 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  section: varchar("section", { length: 32 }).notNull(),
  sortOrder: int("sort_order").notNull(),
});

/**
 * ยอดรวมต่อ Group ของหน่วยล่างสุดจากชีตงบสี #002060 (ปรับเครื่องหมาย XW/XY แล้ว) — ต้นทางของ statement_lines
 * เก็บไว้เพื่อคำนวณงบใหม่ได้เมื่อแทนผังหน่วย โดยไม่ต้องนำเข้าไฟล์ซ้ำ
 */
export const groupAmounts = mysqlTable("group_amounts", {
  period: date("period", { mode: "string" }).notNull(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
  groupCode: varchar("group_code", { length: 16 }).notNull(),
  // เก็บละเอียดกว่างบ: ยอดในไฟล์บางรายการมีทศนิยมเกิน 2 ตำแหน่ง ปัดก่อนรวมขึ้นหน่วยแม่แล้วยอดรวมจะคลาดจาก Excel ระดับสตางค์
  amount: decimal("amount", { precision: 22, scale: 6 }).notNull(),
}, (t) => [primaryKey({ columns: [t.period, t.unitCode, t.groupCode] })]);

/**
 * ยอดราย Group ทั้งบริษัทรายเดือนจากชีต Monthy ในไฟล์ Master (ปรับเครื่องหมาย XW/XY แล้ว) — ต้นทางของหน้า Overview
 * แทนทั้งปีทุกครั้งที่นำเข้าไฟล์ที่มีชีตนี้ · ไม่มีชีต = คงค่าเดิมของปีนั้น · งบคำนวณตอนอ่านด้วย computeStatement
 */
export const companyMonthly = mysqlTable("company_monthly", {
  period: date("period", { mode: "string" }).notNull(),
  groupCode: varchar("group_code", { length: 16 }).notNull(),
  amount: decimal("amount", { precision: 22, scale: 6 }).notNull(),
}, (t) => [primaryKey({ columns: [t.period, t.groupCode] })]);

/**
 * ยอดรวมตามไฟล์ที่ผู้นำเข้าเลือกใช้แทนยอดที่ระบบคำนวณ (เฉพาะชีตที่ยอดไม่ตรง) — ใช้ตอนคำนวณ statement_lines
 * ถูกแทนทั้งหมดทุกครั้งที่นำเข้าไฟล์ใหม่ (เลือก "ใช้ตัวเลขที่ระบบคำนวณ" = ไม่มีแถว)
 */
export const totalOverrides = mysqlTable("total_overrides", {
  period: date("period", { mode: "string" }).notNull(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
  totalKey: varchar("total_key", { length: 16 }).$type<TotalKey>().notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
}, (t) => [primaryKey({ columns: [t.period, t.unitCode, t.totalKey] })]);

/**
 * งบกำไรขาดทุนที่คำนวณเสร็จแล้วของทุกหน่วย (รวมหน่วยแม่) ทุกงวด — Dashboard อ่านตารางนี้อย่างเดียว ไม่คำนวณเอง
 * สร้างจาก group_amounts + ผังหน่วยด้วย src/backend/lib/master-import/compute.ts
 */
export const statementLines = mysqlTable("statement_lines", {
  period: date("period", { mode: "string" }).notNull(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
  lineNo: smallint("line_no").notNull(),
  kind: varchar("kind", { length: 8 }).$type<LineKind>().notNull(),
  groupCode: varchar("group_code", { length: 16 }),
  totalKey: varchar("total_key", { length: 16 }).$type<TotalKey>(),
  label: varchar("label", { length: 255 }).notNull(),
  indent: boolean("indent").notNull().default(false),
  amount: decimal("amount", { precision: 18, scale: 2 }),
  pct: decimal("pct", { precision: 14, scale: 4 }),
}, (t) => [primaryKey({ columns: [t.period, t.unitCode, t.lineNo] }), index("statement_lines_unit_idx").on(t.unitCode, t.period)]);

/**
 * พื้นที่ ตร.ม. ของสาขา ต่อปี (ค่าเดียวต่อสาขาต่อปี ไม่แยกเดือน) — ใช้คิดเกณฑ์ "รายได้จากการขายต่อ ตร.ม." ของ Sales Zone
 * มาจากชีต Branch_Area ในไฟล์ Master ของปีนั้น (แทนทั้งปีทุกครั้งที่นำเข้าไฟล์ที่มีชีตนี้ · ไม่มีชีต = คงค่าเดิมของปี/สำเนาจากปีก่อน)
 * source: file = จากไฟล์ · admin = ผู้ดูแลแก้ในหน้า Branch Area (ไฟล์ Master ถัดไปของปีนั้นที่มีชีตนี้เขียนทับ)
 */
export const branchAreas = mysqlTable("branch_areas", {
  year: year(),
  unitCode: varchar("unit_code", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull().default(""),
  areaSqm: decimal("area_sqm", { precision: 12, scale: 2 }).notNull(),
  source: varchar("source", { length: 8 }).$type<"file" | "admin">().notNull().default("file"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.year, t.unitCode] })]);

/**
 * เกณฑ์รายได้ต่อ ตร.ม. ของแต่ละโซนขาย ต่อเดือน (คำนวณเก็บไว้ — ดู src/backend/lib/sales-benchmark.ts)
 * = รายได้จากการขาย (Group A) รวม ÷ ตร.ม. รวม ของสาขาในโซนที่มี Group A > 0 และมีข้อมูล ตร.ม.
 * คำนวณใหม่ทุกครั้งที่งบคำนวณใหม่ (นำเข้าไฟล์ แก้ผังหน่วย/Group) และเมื่อแก้ ตร.ม.
 */
export const zoneSalesBenchmarks = mysqlTable("zone_sales_benchmarks", {
  period: date("period", { mode: "string" }).notNull(),
  /** หน่วยกลุ่มของโซนขาย (หน่วยแม่ของสาขา เช่น Sz-CMI) */
  zoneCode: varchar("zone_code", { length: 32 }).notNull(),
  salesA: decimal("sales_a", { precision: 22, scale: 2 }).notNull(),
  areaSqm: decimal("area_sqm", { precision: 14, scale: 2 }).notNull(),
  /** จำนวนสาขาที่นับในเกณฑ์ */
  branchCount: int("branch_count").notNull(),
  bahtPerSqm: decimal("baht_per_sqm", { precision: 18, scale: 4 }).notNull(),
}, (t) => [primaryKey({ columns: [t.period, t.zoneCode] })]);

/** รูปแบบเดิม (เก็บเฉพาะหน่วยล่างสุดแล้วคำนวณยอดรวมเอง) — ไม่ได้ใช้แล้ว คงตารางไว้เพื่อไม่ให้ db:push ลบข้อมูลเก่า */
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

/**
 * สถานะไฟล์ Master:
 * active = ไฟล์ที่ระบบใช้อยู่ (ปีละ 1 ไฟล์ — ปีของไฟล์ = ปีของ period) · backup_pending = ถูกแทนแล้ว รอส่งขึ้น Google Drive (ไฟล์ยังอยู่ในเครื่อง)
 * backed_up = ย้ายขึ้น Google Drive แล้ว · no_file = ไม่มีไฟล์ต้นฉบับ (นำเข้าก่อนมีระบบเก็บไฟล์)
 */
export type MasterStatus = "active" | "backup_pending" | "backed_up" | "no_file";

/** ประวัติการนำเข้าไฟล์ Master — 1 แถวต่อ 1 ไฟล์ */
export const uploadLogs = mysqlTable("upload_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  /** เดือนล่าสุดที่มีข้อมูลในไฟล์ */
  period: date("period", { mode: "string" }).notNull(),
  /** ทุกเดือนที่มีข้อมูล คั่นด้วย , เช่น "2026-01-01,2026-02-01" */
  periods: varchar("periods", { length: 255 }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  sizeBytes: int("size_bytes"),
  factCount: int("fact_count").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: varchar("status", { length: 16 }).$type<MasterStatus>().notNull().default("no_file"),
  /** ที่เก็บไฟล์ในเครื่อง (สัมพัทธ์กับโฟลเดอร์เก็บไฟล์) — ลบทิ้งหลัง backup สำเร็จ */
  storedPath: varchar("stored_path", { length: 255 }),
  replacedAt: timestamp("replaced_at"),
  driveFileId: varchar("drive_file_id", { length: 128 }),
  driveLink: varchar("drive_link", { length: 255 }),
  backedUpAt: timestamp("backed_up_at"),
  backupError: varchar("backup_error", { length: 500 }),
});
