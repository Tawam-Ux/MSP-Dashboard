// ผังหน่วยของระบบ กำหนดในโค้ดตามชีต Preview_Code ของไฟล์ Master — ระบบดึงยอดเฉพาะหน่วยในรายการนี้จากชีตงบ
// ตอนนำเข้า ตาราง units ถูกแทนด้วยผังนี้ทั้งหมด (หน่วยที่ไม่อยู่ในผังถูกลบ)
// โซน/ประเภทในไฟล์นี้เป็นค่าเริ่มต้น — ค่าที่ใช้จริงอยู่ในตาราง zones / unit_categories (ผู้ดูแลแก้ในหน้า แก้ไขฐานข้อมูล)
import type { UnitCategory, UnitPage } from "@/backend/db/schema";

export type UnitRow = { code: string; name: string; parentCode: string | null; level: number; sortOrder: number; category: UnitPage | null };

/** โซนที่ใช้สร้างผัง (จากตาราง zones หรือค่าเริ่มต้นในโค้ด) · baseCode = รหัสตามโค้ดของโซนเริ่มต้น (คงเดิมแม้แก้รหัสโซน) */
export type ZoneDef = { code: string; key: string; name: string; label: string; sheetPrefix: string | null; baseCode?: string | null };

/** รหัสโซนที่ใช้จริงจากรหัสที่อ้างถึง — รหัสปัจจุบัน หรือรหัสตามโค้ดของโซนที่ถูกเปลี่ยนรหัสแล้ว (หน่วยในโค้ดอ้างรหัสตามโค้ด) */
export function resolveZoneCode(code: string | null | undefined, zones: ZoneDef[]): string | null {
  if (!code) return null;
  return (zones.find((z) => z.code === code) ?? zones.find((z) => z.baseCode === code))?.code ?? null;
}
/** ประเภทหน่วย: prefix = รหัสกลุ่มในผัง (Sz-CMI) · page = หน้า Dashboard ที่หน่วยประเภทนี้แสดง */
export type CategoryDef = { code: UnitCategory; prefix: string; name: string; page: UnitPage };

/** ประเภทเริ่มต้น (ลบไม่ได้ — หน้า Dashboard สองหน้าผูกกับสองประเภทนี้) เรียงตามลำดับกลุ่มในผัง */
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { code: "operations", prefix: "Op", name: "Operations", page: "operations" },
  { code: "sales", prefix: "Sz", name: "Sales Zone", page: "sales" },
];
export const BUILTIN_CATEGORY_CODES: ReadonlySet<string> = new Set(DEFAULT_CATEGORIES.map((c) => c.code));

// ผัง: MSP (รวมทุกหน่วยงาน) → หน่วยงาน → Zone → Operations (Op) / Sales Zone (Sz) → หน่วย
// รหัสหน่วยบนสุดคงเป็น MSP (สิทธิ์ admin และผู้ใช้เดิมผูกกับรหัสนี้)
export const ROOT_CODE = "MSP";
const ROOT_NAME = "MSP รวมทุกหน่วยงาน";

export type Organization = { code: string; name: string };
/** หน่วยงานเริ่มต้น (ตามชีต Preview_Code) — หน่วยงานอื่นผู้ดูแลเพิ่มในแอปหลังบ้าน (ตาราง organizations) */
export const DEFAULT_ORG: Organization = { code: "MSPI", name: "MSP Interfood" };

type CodeZone = {
  /** รหัสย่อของโซน ใช้ประกอบรหัสกลุ่ม Op-<key> / Sz-<key> (รหัสหน่วยห้ามซ้ำกันทั้งผัง) */
  key: string;
  code: string;
  name: string;
  /** ความหมายของรหัสโซนเป็นภาษาไทย (แสดงในแอปหลังบ้าน คอลัมน์ "ชื่อโซน") */
  label: string;
  /** ชื่อชีตงบภูมิภาคของโซนนี้ (ก่อน _เดือน) — หน่วยใหม่ที่พบในชีตนี้ถือว่าอยู่โซนนี้ */
  sheetPrefix: string;
  /** Operations (Op): สำนักงาน ขนส่ง โรงงาน [รหัส, ชื่อ] */
  operations: [string, string][];
  /** Sales Zone (Sz): สาขาขาย [รหัส, ชื่อ] */
  sales: [string, string][];
};

/** ตามชีต Preview_Code: MSP Interfood → Zone → Operations (Op) / Sales Zone (Sz) → หน่วย */
const ZONES: CodeZone[] = [
  {
    key: "CMI",
    code: "Zone-CMI",
    name: "Zone-CMI",
    label: "โซนเชียงใหม่",
    sheetPrefix: "เชียงใหม่",
    operations: [
      ["CM-HO", "สำนักงานใหญ่"], ["CM-CAR", "ขนส่ง"], ["FAC-PIG", "โรงเชือดเก่า"], ["FAC-PIG1", "โรงเชือดใหม่"],
      ["FAC-PIG2", "โรงเชือดแพร่"], ["FAC-CHICKEN", "โรงไก่"], ["FAC-FISH", "โรงปลาดุก"], ["FAC-VEG", "โรงผัก"],
    ],
    sales: [
      ["CM-101", "สันป่าตอง"], ["CM-102", "พีพีกาดเมืองใหม่"], ["CM-103", "แม่ริม"], ["CM-104", "สารภี"], ["CM-105", "ลำปาง"],
      ["CM-106", "อุ้ยทา"], ["CM-107", "พีพีลำปาง"], ["CM-108", "ประตูเชียงใหม่"], ["CM-109", "ดอยสะเก็ด"], ["CM-113", "จอมทอง"],
      ["CM-114", "ฮอด"], ["CM-115", "สันป่าข่อย"], ["CM-117", "แม่มาลัย"], ["CM-119", "ทุ่งเสี้ยว"], ["CM-120", "หางดง"],
      ["CM-121", "เอ็มพีลำปาง"], ["CM-122", "เชียงดาว"], ["CM-123", "ลี้"], ["CM-124", "เอ็มพีบ้านโฮ่ง"], ["CM-125", "มวลชนสารภี"],
      ["CM-127", "เกาะคา"], ["CM-128", "แม่เมาะ"], ["CM-129", "แม่โจ้"], ["CM-131", "ปาย"], ["CM-132", "ลอง"],
      ["CM-133", "ชมภูมิ่ง"], ["CM-134", "ร้องกวาง"], ["CM-135", "ป่าเห็ว"], ["CM-136", "แม่สะเรียง"], ["CM-137", "ต้นยาง"],
      ["CM-138", "ล้อมแรด"], ["CM-139", "แม่แจ่ม"], ["CM-140", "เอ็มพีชมภูมิ่ง"], ["CM-143", "สันกำแพง"], ["CM-144", "ห้างฉัตร"],
      ["CM-145", "เอ็มพีปาย"], ["CM-146", "ปางมะผ้า"], ["CM-147", "แม่ฮ่องสอน"], ["CM-148", "น้ำโท้ง"], ["CM-149", "บ้านฟ่อน"],
      ["CM-150", "วังชิ้น"], ["CM-151", "ดอยหล่อ"], ["CM-152", "เอ็มพีจอมทอง"], ["CM-153", "เอ็มพีหางดง"], ["CM-154", "เวียงแหง"],
      ["CM-155", "บ้านโฮ่ง"], ["CM-156", "เมีย หมูมวลชน"], ["CM-157", "ตลาดสามแยก"], ["CM-158", "หนองผึ้ง"], ["CM-159", "ตลาดบ้านกาด"],
      ["CM-160", "เอ็มพีลี้"], ["CM-161", "พร้าว"], ["CM-162", "ปงสนุก"], ["CM-163", "ฟ้าเพียงดาว"], ["CM-164", "เอ็มพีแม่สะเรียง"],
      ["CM-165", "แจ้ห่ม"], ["CM-166", "ป่าเดื่อ"], ["CM-167", "เอ็มพีจอมทอง"],
    ],
  },
  {
    key: "NAN",
    code: "Zone-NAN",
    name: "Zone-NAN",
    label: "โซนน่าน",
    sheetPrefix: "น่าน",
    operations: [["NAN-HO", "ออฟฟิศน่าน"]],
    sales: [
      ["NAN-402", "ตั้งจิตอนุสรณ์"], ["NAN-403", "เวียงสา"], ["NAN-404", "ท่าวังผา"], ["NAN-405", "ปัว"],
      ["NAN-408", "เชียงกลาง"], ["NAN-409", "เอ็มพีเวียงสา"], ["NAN-410", "ช้างเผือก"], ["NAN-411", "MP ท่าวังผา"],
    ],
  },
  {
    key: "SU",
    code: "Zone-SU",
    name: "Zone-SU",
    label: "โซนสุโขทัย",
    sheetPrefix: "สุโขทัย",
    operations: [["SU-HO", "ออฟฟิศสุโขทัย"]],
    sales: [
      ["SU-501", "สุโขทัย"], ["SU-502", "สวรรคโลก"], ["SU-503", "วังทอง"], ["SU-504", "ศรีสำโรง"], ["SU-506", "อุตรดิตถ์"],
      ["SU-509", "ศรีสัชนาลัย"], ["SU-510", "พิชัย"], ["SU-512", "หล่มสัก"], ["SU-513", "บางระกำ"], ["SU-514", "อุตรดิตถ์"],
    ],
  },
];

/** โซนเริ่มต้นในโค้ด — ใส่ลงตาราง zones ครั้งแรก (ค่าที่ใช้จริงอ่านจากตาราง) */
export const DEFAULT_ZONES: ZoneDef[] = ZONES.map(({ code, key, name, label, sheetPrefix }) => ({ code, key, name, label, sheetPrefix, baseCode: code }));

/** หน่วยล่างสุดพร้อมตำแหน่งในผัง: หน่วยงาน · โซน · ประเภท (รหัสประเภท) */
export type Leaf = { code: string; name: string; orgCode: string; zoneCode: string; category: UnitCategory };
export type LeafSettings = Omit<Leaf, "code">;

/** หน่วยล่างสุดที่กำหนดในโค้ด (ตามชีต Preview_Code) — ทุกหน่วยอยู่ในหน่วยงานเริ่มต้น */
const CODE_LEAVES: Leaf[] = ZONES.flatMap((z) => [
  ...z.operations.map(([code, name]): Leaf => ({ code, name, orgCode: DEFAULT_ORG.code, zoneCode: z.code, category: "operations" })),
  ...z.sales.map(([code, name]): Leaf => ({ code, name, orgCode: DEFAULT_ORG.code, zoneCode: z.code, category: "sales" })),
]);

/** รหัสหน่วยล่างสุดที่กำหนดในโค้ด — คอลัมน์หน่วยอื่นในชีตงบ = หน่วยใหม่ที่ตรวจพบ */
export const IMPORT_UNIT_CODES: ReadonlySet<string> = new Set(CODE_LEAVES.map((u) => u.code));

/** หน่วยใหม่จากไฟล์ (ตาราง detected_units) · category null = ยังรอเลือกประเภท · orgCode null = หน่วยงานเริ่มต้น */
export type AssignedUnit = { code: string; name: string; orgCode: string | null; zoneCode: string | null; category: UnitCategory | null };
/** ค่าที่ผู้ดูแลแก้ทับหน่วยในผังในโค้ด (ตาราง unit_overrides) · null = ใช้ค่าตามโค้ด */
export type UnitOverride = {
  code: string; name: string | null; orgCode: string | null; zoneCode: string | null; category: UnitCategory | null;
  /** ลบออกจากผังแล้ว */
  removed?: boolean;
};

const isDefault = (orgCode: string) => orgCode === DEFAULT_ORG.code;

// รหัสกลุ่มในผัง: หน่วยงานเริ่มต้นใช้รหัสเดิม (Zone-CMI, Sz-CMI) ให้สิทธิ์ผู้ใช้ที่ผูกไว้ยังใช้ได้ · หน่วยงานอื่นมีรหัสหน่วยงานนำหน้า
export const orgNodeCode = (orgCode: string) => `ORG-${orgCode}`;
export const zoneNodeCode = (orgCode: string, zone: Pick<ZoneDef, "code">) => (isDefault(orgCode) ? zone.code : `${orgCode}-${zone.code}`);
export const groupNodeCode = (orgCode: string, zone: Pick<ZoneDef, "key">, category: Pick<CategoryDef, "prefix">) =>
  `${isDefault(orgCode) ? "" : `${orgCode}-`}${category.prefix}-${zone.key}`;

/** ค่าตามโค้ดของหน่วยล่างสุด (ไม่ใช่หน่วยในโค้ด = null) */
export function codeLeafDefaults(code: string): LeafSettings | null {
  const leaf = CODE_LEAVES.find((u) => u.code === code);
  return leaf ? { name: leaf.name, orgCode: leaf.orgCode, zoneCode: leaf.zoneCode, category: leaf.category } : null;
}

/**
 * หน่วยล่างสุดทั้งหมดที่อยู่ในผัง = หน่วยในโค้ด (ทับด้วยค่าที่ผู้ดูแลแก้) + หน่วยใหม่ที่เลือกประเภทแล้ว
 * หน่วยใหม่ที่ยังไม่เลือกประเภท/ไม่มีโซน/รหัสชนกับหน่วยในโค้ด ไม่อยู่ในผัง · หน่วยงานที่ไม่มีแล้ว → หน่วยงานเริ่มต้น
 * โซน/ประเภทที่ไม่มีแล้ว (ถูกลบ) → หน่วยนั้นไม่อยู่ในผัง (ปกติลบไม่ได้ถ้ายังมีหน่วยอยู่ — กันไว้อีกชั้น)
 */
export function resolveLeaves(
  detected: AssignedUnit[],
  overrides: UnitOverride[],
  orgs: Organization[],
  zones: ZoneDef[] = DEFAULT_ZONES,
  categories: CategoryDef[] = DEFAULT_CATEGORIES,
): Leaf[] {
  const orgCodes = new Set([DEFAULT_ORG.code, ...orgs.map((o) => o.code)]);
  const validOrg = (code: string | null | undefined) => (code && orgCodes.has(code) ? code : DEFAULT_ORG.code);
  const zoneCodes = new Set(zones.map((z) => z.code));
  const categoryCodes = new Set(categories.map((c) => c.code));
  const byCode = new Map(overrides.map((o) => [o.code, o]));
  // หน่วยในโค้ดที่ผู้ดูแลลบออกแล้วไม่อยู่ในผัง (รหัสว่างให้หน่วยใหม่จากไฟล์ที่เลือกคืนใช้ได้)
  // โซนตามโค้ดหาผ่าน resolveZoneCode — โซนที่ถูกเปลี่ยนรหัสยังพบได้จาก baseCode
  const leaves = CODE_LEAVES.filter((leaf) => !byCode.get(leaf.code)?.removed).map((leaf): Leaf => {
    const o = byCode.get(leaf.code);
    const baseZone = resolveZoneCode(leaf.zoneCode, zones) ?? leaf.zoneCode;
    if (!o) return { ...leaf, zoneCode: baseZone };
    return {
      code: leaf.code,
      name: o.name ?? leaf.name,
      orgCode: validOrg(o.orgCode ?? leaf.orgCode),
      zoneCode: o.zoneCode && zoneCodes.has(o.zoneCode) ? o.zoneCode : baseZone,
      category: o.category && categoryCodes.has(o.category) ? o.category : leaf.category,
    };
  }).filter((l) => zoneCodes.has(l.zoneCode) && categoryCodes.has(l.category));
  const known = new Set(leaves.map((u) => u.code));
  for (const d of detected) {
    if (!d.category || !categoryCodes.has(d.category) || !d.zoneCode || !zoneCodes.has(d.zoneCode) || known.has(d.code)) continue;
    leaves.push({ code: d.code, name: d.name, orgCode: validOrg(d.orgCode), zoneCode: d.zoneCode, category: d.category });
    known.add(d.code);
  }
  return leaves;
}

/** เรียงรหัสหน่วยแบบตัวอักษรแล้วตัวเลข (CM-99 ก่อน CM-101) — แบบเดียวกับตารางในแอปหลังบ้าน */
const byCodeOrder = new Intl.Collator("th", { numeric: true });

/**
 * ผังเต็มที่ใช้จริง เรียงแม่ก่อนลูก: MSP → หน่วยงาน → Zone → กลุ่มตามประเภท (Op-/Sz-/…) → หน่วย
 * หน่วยงานเริ่มต้นมีทุกโซนและกลุ่มของประเภทเริ่มต้นเสมอ · หน่วยงานอื่นและประเภทที่ผู้ดูแลเพิ่ม มีเฉพาะโซน/กลุ่มที่มีหน่วยอยู่
 * ชื่อกลุ่มมีชื่อโซน (และชื่อหน่วยงานถ้าไม่ใช่หน่วยงานเริ่มต้น) เพราะหน้า Sales Zone แสดงหน่วยแม่ของสาขาขายเป็นชื่อโซน
 * หน่วยล่างสุดเก็บ category = หน้าที่แสดง (page ของประเภท) ให้ Dashboard แยกหน้าได้โดยไม่ต้องรู้จักประเภท
 */
export function buildUnitTree(
  detected: AssignedUnit[] = [],
  overrides: UnitOverride[] = [],
  orgs: Organization[] = [],
  zones: ZoneDef[] = DEFAULT_ZONES,
  categories: CategoryDef[] = DEFAULT_CATEGORIES,
): UnitRow[] {
  const leaves = resolveLeaves(detected, overrides, orgs, zones, categories);
  const orgList = [orgs.find((o) => isDefault(o.code)) ?? DEFAULT_ORG, ...orgs.filter((o) => !isDefault(o.code))];
  const rows: UnitRow[] = [{ code: ROOT_CODE, name: ROOT_NAME, parentCode: null, level: 0, sortOrder: 0, category: null }];
  const add = (code: string, name: string, parentCode: string, level: number, category: UnitPage | null) =>
    rows.push({ code, name, parentCode, level, sortOrder: rows.length, category });

  for (const org of orgList) {
    const orgNode = orgNodeCode(org.code);
    add(orgNode, org.name, ROOT_CODE, 1, null);
    const suffix = isDefault(org.code) ? "" : ` · ${org.name}`;
    for (const zone of zones) {
      const inZone = leaves.filter((l) => l.orgCode === org.code && l.zoneCode === zone.code);
      if (!isDefault(org.code) && inZone.length === 0) continue;
      const zoneNode = zoneNodeCode(org.code, zone);
      add(zoneNode, `${zone.name}${suffix}`, orgNode, 2, null);
      for (const category of categories) {
        // เรียงตามรหัส (ตัวอักษรแล้วตัวเลข) — หน่วยจากไฟล์/ที่เคยลบแล้วเลือกคืนแทรกตามลำดับ ไม่ต่อท้ายกลุ่ม
        const inGroup = inZone.filter((l) => l.category === category.code).sort((a, b) => byCodeOrder.compare(a.code, b.code));
        if ((!isDefault(org.code) || !BUILTIN_CATEGORY_CODES.has(category.code)) && inGroup.length === 0) continue;
        const group = groupNodeCode(org.code, zone, category);
        add(group, `${category.name} (${category.prefix}) ${zone.name}${suffix}`, zoneNode, 3, null);
        for (const leaf of inGroup) add(leaf.code, leaf.name, group, 4, category.page);
      }
    }
  }
  return rows;
}

/** ผังตามโค้ดล้วน (ยังไม่มีค่าแก้ทับ/หน่วยใหม่/หน่วยงานอื่น) */
export const UNIT_TREE: UnitRow[] = buildUnitTree();

/** โซนของชีตงบ: "น่าน_ม.ค." → Zone-NAN · ชีตงบรวม/ชีตอื่น → null (ต้องเลือกโซนเอง) */
export function zoneOfSheet(sheet: string, zones: ZoneDef[] = DEFAULT_ZONES): string | null {
  const prefix = sheet.includes("_") ? sheet.slice(0, sheet.lastIndexOf("_")) : null;
  return (prefix && zones.find((z) => z.sheetPrefix === prefix)?.code) || null;
}

/**
 * สิทธิ์ผู้ใช้ที่ผูกกับหน่วยของผังเดิม → หน่วยในผังใหม่ที่เห็นข้อมูลชุดเดิม (ใช้ตอนแทนผัง)
 * CMI-SHOP เดิมมีแค่สาขาขาย → Sz-CMI · NAN/SU เดิมมีออฟฟิศ + สาขา → ทั้งโซน · หน่วยเดิมอื่นที่ไม่อยู่ในผังใหม่ สิทธิ์ถูกลบ
 */
export const LEGACY_UNIT_MAP: Record<string, string> = { "CMI-SHOP": "Sz-CMI", NAN: "Zone-NAN", SU: "Zone-SU" };

export type UnitTreeChange = { added: UnitRow[]; removed: { code: string; name: string }[]; updated: UnitRow[] };

/** ผังในฐานข้อมูลจะเปลี่ยนอย่างไรเมื่อแทนด้วยผังใหม่ (ใช้แสดงในหน้าตรวจไฟล์) */
export function diffUnitTree(
  existing: { code: string; name: string; parentCode: string | null; category: UnitCategory | null }[],
  tree: UnitRow[] = UNIT_TREE,
): UnitTreeChange {
  const byCode = new Map(existing.map((u) => [u.code, u]));
  const inTree = new Set(tree.map((u) => u.code));
  return {
    added: tree.filter((u) => !byCode.has(u.code)),
    removed: existing.filter((u) => !inTree.has(u.code)).map(({ code, name }) => ({ code, name })),
    updated: tree.filter((u) => {
      const old = byCode.get(u.code);
      return old && (old.name !== u.name || old.parentCode !== u.parentCode || old.category !== u.category);
    }),
  };
}
