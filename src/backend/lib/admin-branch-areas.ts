import { and, between, eq, inArray } from "drizzle-orm";
import type { Db } from "@/backend/db";
import { branchAreas, groupAmounts, units } from "@/backend/db/schema";
import { unitCodesWithData } from "./import-workbook";
import { recomputeSalesBenchmarks, SALES_GROUP } from "./sales-benchmark";

// หน้า "Branch Area" ในแอปหลังบ้าน (รูปแบบ ra-data-simple-rest: id = รหัสสาขา)
// ทุกสาขาขาย (ประเภท sales ในผังหน่วย) พร้อม ตร.ม. ที่บันทึกไว้ + ตร.ม. ที่บันทึกไว้แต่รหัสไม่อยู่ในผัง

export type BranchAreaRecord = {
  id: string;
  code: string;
  name: string;
  /** ชื่อโซนขาย (หน่วยแม่ในผัง) · ว่าง = รหัสไม่อยู่ในผังหน่วย */
  zone: string;
  areaSqm: number | null;
  /** file = จากชีต Branch_Area · admin = แก้ในหน้านี้ · null = ยังไม่มีข้อมูล */
  source: "file" | "admin" | null;
  updatedAt: Date | null;
  /** มีรายได้จากการขาย (Group A) ในข้อมูลปัจจุบันหรือไม่ — มีแต่ไม่มี ตร.ม. = ไม่ถูกนับในเกณฑ์ */
  hasSales: boolean;
  /** มีข้อมูลใดๆ ในปีนี้ — ผังของปีคัดลอกมาจากปีอื่น สาขาที่ไม่มีข้อมูลในปีนี้ (เช่น เปิดปีหลัง) ซ่อนไว้เป็นค่าเริ่มต้น */
  hasData: boolean;
  /** ok = นับในเกณฑ์ได้ · missing = มีรายได้แต่ไม่มี ตร.ม. · idle = ไม่มีรายได้ (ไม่นับอยู่แล้ว) · unknown = รหัสไม่อยู่ในผัง */
  status: "ok" | "missing" | "idle" | "unknown";
  statusLabel: string;
};

const STATUS_LABEL: Record<BranchAreaRecord["status"], string> = {
  ok: "นับในเกณฑ์",
  missing: "มีรายได้แต่ไม่มี ตร.ม.",
  idle: "ไม่มีรายได้จากการขาย",
  unknown: "รหัสไม่อยู่ในผังหน่วย",
};

/** สาขาขายในผังของปีนี้ + ตร.ม. ของปีนี้ · hasSales = มีรายได้จากการขายในงวดของปีนี้ */
export async function allBranchAreaRows(db: Pick<Db, "select" | "selectDistinct">, year: number): Promise<BranchAreaRecord[]> {
  const [branches, areas, selling, withData] = await Promise.all([
    db
      .select({ code: units.code, name: units.name, parentCode: units.parentCode, sortOrder: units.sortOrder })
      .from(units)
      .where(and(eq(units.year, year), eq(units.category, "sales"))),
    db.select().from(branchAreas).where(eq(branchAreas.year, year)),
    db
      .selectDistinct({ code: groupAmounts.unitCode })
      .from(groupAmounts)
      .where(and(eq(groupAmounts.groupCode, SALES_GROUP), between(groupAmounts.period, `${year}-01-01`, `${year}-12-01`))),
    unitCodesWithData(db, year),
  ]);
  const parentCodes = [...new Set(branches.flatMap((b) => (b.parentCode ? [b.parentCode] : [])))];
  const parents = parentCodes.length
    ? new Map(
      (await db.select({ code: units.code, name: units.name }).from(units).where(and(eq(units.year, year), inArray(units.code, parentCodes))))
        .map((p) => [p.code, p.name]),
    )
    : new Map<string, string>();
  const areaOf = new Map(areas.map((a) => [a.unitCode, a]));
  const hasSales = new Set(selling.map((s) => s.code));

  const inTree: BranchAreaRecord[] = branches
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => {
      const a = areaOf.get(b.code);
      const sales = hasSales.has(b.code);
      const status = !sales ? "idle" : a ? "ok" : "missing";
      return {
        id: b.code, code: b.code, name: b.name, zone: (b.parentCode && parents.get(b.parentCode)) ?? "",
        areaSqm: a ? Number(a.areaSqm) : null, source: a?.source ?? null, updatedAt: a?.updatedAt ?? null,
        hasSales: sales, hasData: withData.has(b.code), status, statusLabel: STATUS_LABEL[status],
      };
    });
  const known = new Set(branches.map((b) => b.code));
  const orphans: BranchAreaRecord[] = areas
    .filter((a) => !known.has(a.unitCode))
    .map((a) => ({
      id: a.unitCode, code: a.unitCode, name: a.name, zone: "",
      areaSqm: Number(a.areaSqm), source: a.source, updatedAt: a.updatedAt,
      hasSales: hasSales.has(a.unitCode), hasData: withData.has(a.unitCode), status: "unknown", statusLabel: STATUS_LABEL.unknown,
    }));
  return [...inTree, ...orphans];
}

/** แก้ ตร.ม. ของสาขาในปีนี้ (ว่าง = ลบข้อมูล) แล้วคำนวณเกณฑ์ของปีนี้ใหม่ — ไฟล์ Master ถัดไปของปีนี้ที่มีชีต Branch_Area เขียนทับ */
export async function setBranchArea(db: Db, year: number, code: string, name: string, areaSqm: number | null) {
  await db.transaction(async (tx) => {
    await tx.delete(branchAreas).where(and(eq(branchAreas.year, year), eq(branchAreas.unitCode, code)));
    if (areaSqm != null) {
      await tx.insert(branchAreas).values({ year, unitCode: code, name: name.slice(0, 128), areaSqm: areaSqm.toFixed(2), source: "admin", updatedAt: new Date() });
    }
    await recomputeSalesBenchmarks(tx, year);
  });
}
