import "server-only";
import { z } from "zod";
import { db } from "@/backend/db";
import { apiError, readJson } from "./admin-api";
import { listCategories, listOrganizations, listZones } from "./import-workbook";
import {
  createZone, deleteOrganization, deleteZone, leafCounts, leafDataCounts, updateOrganization, updateZone, zoneKeyOf,
} from "./master-data";
import { BUILTIN_CATEGORY_CODES, DEFAULT_ORG } from "./master-import/units";

// รูปแบบข้อมูลของ API หน้า "แก้ไขฐานข้อมูล" (ra-data-simple-rest: id = รหัส · ลบ/แก้ตอบ record กลับ)

/** ข้อผิดพลาดจากการตรวจข้อมูล (มีหน่วยอยู่ ชื่อซ้ำ ฯลฯ) → 400 พร้อมข้อความภาษาไทย */
export async function guard(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (e) {
    return apiError(400, e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
  }
}

// ---------- โซน ----------

/**
 * unitCount = หน่วยในผัง · dataUnitCount = หน่วยที่มีข้อมูลในปีนี้
 * hasData: มีหน่วยที่มีข้อมูล หรือยังไม่มีหน่วยเลย (เพิ่งสร้าง — ต้องเห็นเพื่อย้ายหน่วยเข้า) → ซ่อนเฉพาะรายการที่มีแต่หน่วยไม่มีข้อมูลในปีนี้
 */
const withDataCount = (unitCount: number, dataUnitCount: number) => ({ unitCount, dataUnitCount, hasData: dataUnitCount > 0 || unitCount === 0 });

export async function zoneRecords(year: number) {
  const zoneList = await listZones(db, year);
  const [counts, data] = await Promise.all([leafCounts(db, year), leafDataCounts(db, year)]);
  return zoneList.map((z, order) => ({ id: z.code, ...z, ...withDataCount(counts.zone.get(z.code) ?? 0, data.zone.get(z.code) ?? 0), order }));
}

/** รหัสโซน เช่น Zone-PYO — ส่วนหลัง Zone- ใช้ประกอบรหัสกลุ่ม (Sz-PYO) จึงยาวได้ไม่เกิน 16 ตัว */
const zoneCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/, "รหัสใช้ A-Z, 0-9, - หรือ _ ยาว 2-32 ตัว เช่น Zone-PYO")
  .refine((c) => /^[A-Za-z0-9_-]{1,16}$/.test(zoneKeyOf(c)), "ส่วนหลัง Zone- ยาวได้ไม่เกิน 16 ตัว");
const zoneFields = {
  code: zoneCodeSchema,
  name: z.string().trim().max(64).optional(),
  label: z.string().trim().min(1, "ใส่ชื่อโซนภาษาไทย").max(128),
  sheetPrefix: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(64).nullish()),
};
const createZoneSchema = z.object(zoneFields);
const updateZoneSchema = z.object({ ...zoneFields, name: z.string().trim().min(1, "ใส่ชื่อโซน").max(64) });

export async function postZone(req: Request, year: number) {
  const parsed = createZoneSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  return guard(async () => {
    const { code, ...input } = parsed.data;
    const row = await createZone(db, year, code, { ...input, sheetPrefix: input.sheetPrefix ?? null });
    return Response.json((await zoneRecords(year)).find((z) => z.code === row.code));
  });
}

/** แก้โซน (รวมรหัส) — ตอบ record ที่รหัสใหม่ */
export async function putZone(req: Request, year: number, code: string) {
  const parsed = updateZoneSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  return guard(async () => {
    await updateZone(db, year, code, { ...parsed.data, sheetPrefix: parsed.data.sheetPrefix ?? null });
    return Response.json((await zoneRecords(year)).find((z) => z.code === parsed.data.code));
  });
}

export async function removeZone(year: number, code: string) {
  const record = (await zoneRecords(year)).find((z) => z.code === code);
  if (!record) return apiError(404, "ไม่พบโซน");
  return guard(async () => {
    await deleteZone(db, year, code);
    return Response.json(record);
  });
}

// ---------- หน่วยงาน ----------

export async function orgRecords(year: number) {
  const [counts, data] = await Promise.all([leafCounts(db, year), leafDataCounts(db, year)]);
  const orgs = await listOrganizations(db, year);
  return orgs.map((o, order) => ({
    id: o.code, ...o, isDefault: o.code === DEFAULT_ORG.code, ...withDataCount(counts.org.get(o.code) ?? 0, data.org.get(o.code) ?? 0), order,
  }));
}

/** รหัสหน่วยงาน (ตาราง organizations ยาวได้ 10 ตัว) */
export const orgCodeSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,9}$/, "รหัสใช้ A-Z, 0-9, - หรือ _ ยาว 1-10 ตัว เช่น O2");
const orgSchema = z.object({ code: orgCodeSchema, name: z.string().trim().min(1, "ใส่ชื่อหน่วยงาน").max(128) });

/** แก้หน่วยงาน (รวมรหัส) — ตอบ record ที่รหัสใหม่ */
export async function putOrg(req: Request, year: number, code: string) {
  const parsed = orgSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  return guard(async () => {
    await updateOrganization(db, year, code, parsed.data);
    return Response.json((await orgRecords(year)).find((o) => o.code === parsed.data.code));
  });
}

export async function removeOrg(year: number, code: string) {
  const record = (await orgRecords(year)).find((o) => o.code === code);
  if (!record) return apiError(404, "ไม่พบหน่วยงาน");
  return guard(async () => {
    await deleteOrganization(db, year, code);
    return Response.json(record);
  });
}

// ---------- ประเภทหน่วย ----------

export async function categoryRecords(year: number) {
  const categories = await listCategories(db, year);
  const counts = await leafCounts(db, year);
  return categories.map((c, order) => ({
    id: c.code, ...c, builtin: BUILTIN_CATEGORY_CODES.has(c.code), unitCount: counts.category.get(c.code) ?? 0, order,
  }));
}
