import { asc, eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { detectedGroups } from "@/backend/db/schema";
import { listExtraGroups, listGroupRenames } from "./import-workbook";
import { GROUP_SECTIONS, groupPlacements, type GroupSection } from "./master-import/compute";

// แถวของหน้า "Group ใหม่" และ "Group" ในแอปหลังบ้าน (รูปแบบ ra-data-simple-rest: id = รหัส Group)

export type GroupRow = {
  id: string;
  code: string;
  name: string;
  section: GroupSection | null;
  sectionLabel: string | null;
  fileAmount: number;
  detectedAt: Date;
  assignedAt: Date | null;
};

const labelOf = new Map(GROUP_SECTIONS.map((s) => [s.section, s.label]));

/** Group ใหม่ที่ตรวจพบในไฟล์ของปีนี้ */
export async function detectedGroupRows(year: number): Promise<GroupRow[]> {
  const rows = await db.select().from(detectedGroups).where(eq(detectedGroups.year, year)).orderBy(asc(detectedGroups.code));
  return rows.map((r) => ({
    id: r.code,
    code: r.code,
    name: r.name,
    section: r.section,
    sectionLabel: r.section ? (labelOf.get(r.section) ?? r.section) : null,
    fileAmount: Number(r.fileAmount),
    detectedAt: r.detectedAt,
    assignedAt: r.assignedAt,
  }));
}

/** หนึ่งแถวของหน้า Group: ทุก Group ที่ระบบรู้จัก ไม่ว่าจะอยู่ใน Flow ของไฟล์ หรือเป็น Group ใหม่ */
export type AllGroupRow = {
  id: string;
  code: string;
  /** ชื่อที่แสดงในงบ */
  name: string;
  /** ชื่อตามโค้ด (Group ใน Flow) หรือตามไฟล์ (Group ใหม่) */
  defaultName: string;
  /** flow = อยู่ใน Flow ของไฟล์ Excel (หมวดตายตัว) · new = Group ใหม่ที่ระบบตรวจพบ */
  source: "flow" | "new";
  section: GroupSection | null;
  sectionLabel: string;
  /** ผลต่อยอดรวมในงบ */
  effect: string;
  status: "counted" | "pending";
  /** ลำดับแถวในงบ (Group ที่รอเลือกต่อท้าย) */
  order: number;
};

export async function allGroupRows(year: number): Promise<AllGroupRow[]> {
  const [extra, rename, detected] = await Promise.all([listExtraGroups(db, year), listGroupRenames(db, year), detectedGroupRows(year)]);
  const placed = groupPlacements(extra);
  const counted: AllGroupRow[] = placed.map((p) => {
    const d = detected.find((x) => x.code === p.code);
    return {
      id: p.code,
      code: p.code,
      name: p.inFlow ? (rename[p.code] ?? p.defaultName) : p.defaultName,
      defaultName: p.inFlow ? p.defaultName : (d?.name ?? p.defaultName),
      source: p.inFlow ? "flow" : "new",
      section: p.section,
      sectionLabel: labelOf.get(p.section) ?? p.section,
      effect: p.effect,
      status: "counted",
      order: p.order,
    };
  });
  const placedCodes = new Set(placed.map((p) => p.code));
  const pending: AllGroupRow[] = detected
    .filter((d) => !placedCodes.has(d.code))
    .map((d, i) => ({
      id: d.code,
      code: d.code,
      name: d.name,
      defaultName: d.name,
      source: "new",
      section: null,
      sectionLabel: "ยังไม่เลือกหมวด",
      effect: "ยังไม่นับในงบ",
      status: "pending",
      order: placed.length + i,
    }));
  return [...counted, ...pending];
}
