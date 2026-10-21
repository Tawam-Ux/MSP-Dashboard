import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db";
import { detectedUnits, unitOverrides, units, type UnitCategory, type UnitPage } from "@/backend/db/schema";
import { apiError, readJson } from "./admin-api";
import { currentLeaves, deleteLeafUnits, listCategories, listOrganizations, listZones, unitCodesWithData, updateLeafUnits } from "./import-workbook";
import { codeLeafDefaults } from "./master-import/units";

// ข้อมูลหน่วยสำหรับ API /api/admin/* (แอปหลังบ้าน) — แยกหน้า Sales Zone / Operations / หน่วยงานใหม่

export type UnitListRow = Omit<typeof units.$inferSelect, "category"> & {
  id: string;
  treeIndex: number;
  hasChildren: boolean;
  /** หน่วยล่างสุด: โซน/หน่วยงานที่ใช้จริง · กลุ่ม: โซน/หน่วยงานที่กลุ่มอยู่ (ตามผัง) */
  zoneCode: string | null;
  zoneName: string | null;
  /** ความหมายของโซนเป็นภาษาไทย เช่น Zone-CMI → โซนเชียงใหม่ */
  zoneLabel: string | null;
  orgCode: string | null;
  orgName: string | null;
  /** หน่วยล่างสุด: รหัส/ชื่อประเภท และหน้า Dashboard ที่แสดง · กลุ่ม = null */
  category: UnitCategory | null;
  categoryName: string | null;
  page: UnitPage | null;
  /** detected = หน่วยใหม่ที่ผู้ดูแลเลือกประเภทเอง (ไม่ได้กำหนดในโค้ด) */
  source: "code" | "detected";
  /** มีข้อมูลในปีนี้ — ผังของปีคัดลอกมาจากปีอื่น จึงมีหน่วยที่ไม่มีข้อมูลในปีนี้ (รายการซ่อนไว้เป็นค่าเริ่มต้น) */
  hasData: boolean;
};

/** ชื่อโซน/ประเภท/หน่วยงานของปีนี้จากรหัส (อ่านจากฐานข้อมูลครั้งเดียวต่อคำขอ) */
async function lookups(year: number) {
  const zoneList = await listZones(db, year);
  const [categories, orgs] = await Promise.all([listCategories(db, year), listOrganizations(db, year)]);
  return {
    zoneByCode: (code: string | null) => zoneList.find((z) => z.code === code) ?? null,
    zoneByName: (name: string | null) => zoneList.find((z) => z.name === name) ?? null,
    categoryName: (code: string | null) => categories.find((c) => c.code === code)?.name ?? null,
    orgName: (code: string) => orgs.find((o) => o.code === code)?.name ?? code,
  };
}

/** ทุกหน่วยในผังของปีนี้ เรียงแบบต้นไม้ (แม่ตามด้วยลูก) พร้อมโซน (ระดับ 2) และหน่วยงาน (ระดับ 1) */
export async function unitListRows(year: number): Promise<UnitListRow[]> {
  const look = await lookups(year);
  const [unitRows, detected, leaves, withData] = await Promise.all([
    db.select().from(units).where(eq(units.year, year)),
    db.select({ code: detectedUnits.code }).from(detectedUnits).where(eq(detectedUnits.year, year)),
    currentLeaves(db, year),
    unitCodesWithData(db, year),
  ]);
  const detectedCodes = new Set(detected.map((d) => d.code));
  const leafByCode = new Map(leaves.map((l) => [l.code, l]));
  const byCode = new Map(unitRows.map((u) => [u.code, u]));
  const ancestorAt = (code: string, level: number) => {
    let u = byCode.get(code);
    while (u && u.level > level && u.parentCode) u = byCode.get(u.parentCode);
    return u && u.level === level ? u : null;
  };

  const parents = new Set(unitRows.map((u) => u.parentCode));
  const tree: UnitListRow[] = [];
  const visit = (parent: string | null) => {
    for (const u of unitRows.filter((x) => x.parentCode === parent).sort((a, b) => a.sortOrder - b.sortOrder)) {
      const leaf = leafByCode.get(u.code);
      const zoneNode = ancestorAt(u.code, 2);
      const org = ancestorAt(u.code, 1);
      const zone = leaf ? look.zoneByCode(leaf.zoneCode) : look.zoneByName(zoneNode?.name ?? null);
      tree.push({
        id: u.code, ...u, treeIndex: tree.length, hasChildren: parents.has(u.code),
        zoneCode: leaf?.zoneCode ?? null,
        zoneName: zone?.name ?? zoneNode?.name ?? null,
        zoneLabel: zone?.label ?? null,
        orgCode: leaf?.orgCode ?? null,
        orgName: leaf ? look.orgName(leaf.orgCode) : (org?.name ?? null),
        category: leaf?.category ?? null,
        categoryName: look.categoryName(leaf?.category ?? null),
        page: leaf ? u.category : null,
        source: detectedCodes.has(u.code) ? "detected" : "code",
        hasData: withData.has(u.code),
      });
      visit(u.code);
    }
  };
  visit(null);
  return tree;
}

/** หน่วยล่างสุดที่แสดงในหน้าหนึ่งของ Dashboard (หน้า Sales Zone / Operations ของแอปหลังบ้าน) — รวมประเภทที่ผู้ดูแลเพิ่ม */
export async function unitsOfPage(year: number, page: UnitPage) {
  return (await unitListRows(year)).filter((u) => !u.hasChildren && u.page === page);
}

/** หน่วยล่างสุดหนึ่งหน่วยสำหรับหน้าแก้ไข + ค่าตามโค้ด (ไว้แสดงว่าแก้อะไรไปแล้ว) */
export async function leafUnitRecord(year: number, code: string) {
  const row = (await unitListRows(year)).find((u) => u.code === code && !u.hasChildren && u.category);
  if (!row) return null;
  const defaults = codeLeafDefaults(code);
  const [[override], look] = await Promise.all([
    defaults ? db.select().from(unitOverrides).where(and(eq(unitOverrides.year, year), eq(unitOverrides.code, code))) : Promise.resolve([]),
    lookups(year),
  ]);
  return {
    ...row,
    defaults: defaults && {
      ...defaults,
      zoneName: look.zoneByCode(defaults.zoneCode)?.name ?? `${defaults.zoneCode} (ลบแล้ว)`,
      orgName: look.orgName(defaults.orgCode),
      categoryName: look.categoryName(defaults.category) ?? defaults.category,
    },
    overridden: !!override,
  };
}

// ตรวจว่ามีประเภทนี้จริงตอนบันทึก (updateLeafUnits) — ประเภทเพิ่มได้ จึงไม่ล็อกค่าที่นี่
const category = z.string().trim().min(1, "เลือกประเภท");
const leafSchema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อหน่วย").max(128),
  orgCode: z.string().trim().min(1, "เลือกหน่วยงาน"),
  zoneCode: z.string().trim().min(1, "เลือกโซน"),
  category,
});

/** PUT ของหน้า หน่วยงาน Sales Zone / Operations (แก้ทีละหน่วย): ชื่อ/หน่วยงาน/โซน/ประเภท แล้วคำนวณงบใหม่ */
export async function putLeafUnit(req: Request, year: number, code: string) {
  const current = await leafUnitRecord(year, code);
  if (!current) return apiError(404, "ไม่พบหน่วย");
  const parsed = leafSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await updateLeafUnits(db, year, [code], parsed.data);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  // ย้ายประเภทแล้วหน่วยไปอยู่อีกหน้า — ยังตอบข้อมูลล่าสุดให้ react-admin
  return Response.json(await leafUnitRecord(year, code));
}

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "เลือกหน่วยอย่างน้อย 1 หน่วย").max(1000),
  changes: z
    .object({ orgCode: z.string().min(1).optional(), zoneCode: z.string().min(1).optional(), category: category.optional() })
    .refine((c) => c.orgCode || c.zoneCode || c.category, "เลือกค่าที่จะเปลี่ยนอย่างน้อย 1 อย่าง"),
});

/** แก้หลายหน่วยพร้อมกัน (ปุ่ม แก้ไข ในหน้า หน่วยงาน Sales Zone / Operations) — transaction เดียว คำนวณงบใหม่ครั้งเดียว */
export async function postLeafBulk(req: Request, year: number) {
  const parsed = bulkSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await updateLeafUnits(db, year, parsed.data.ids, parsed.data.changes);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
  return Response.json({ updated: parsed.data.ids.length });
}

const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1, "เลือกหน่วยอย่างน้อย 1 หน่วย").max(1000) });

/** ลบหลายหน่วยออกจากผังพร้อมกัน (ปุ่ม ลบ ในโหมดแก้ไข) — transaction เดียว คำนวณงบใหม่ครั้งเดียว */
export async function postLeafDelete(req: Request, year: number) {
  const parsed = deleteSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  try {
    await deleteLeafUnits(db, year, parsed.data.ids);
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "ลบไม่สำเร็จ");
  }
  return Response.json({ deleted: parsed.data.ids.length });
}

export type DetectedRow = typeof detectedUnits.$inferSelect & { id: string; zoneName: string | null; hasData: boolean };

/** หน่วยใหม่ที่ตรวจพบในไฟล์ของปีนี้ (ทั้งที่รอเลือกและเลือกแล้ว) · hasData = มียอดในไฟล์ของปีนี้ (ไม่ใช่แถวที่คัดลอกมาจากปีอื่น) */
export async function detectedRows(year: number): Promise<DetectedRow[]> {
  const look = await lookups(year);
  const [rows, withData] = await Promise.all([
    db.select().from(detectedUnits).where(eq(detectedUnits.year, year)),
    unitCodesWithData(db, year),
  ]);
  return rows.map((d) => ({ id: d.code, ...d, zoneName: look.zoneByCode(d.zoneCode)?.name ?? null, hasData: withData.has(d.code) }));
}
