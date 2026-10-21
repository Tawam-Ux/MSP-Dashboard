import { describe, expect, it } from "vitest";
import { buildClosure } from "../authz/scope";
import {
  buildUnitTree, codeLeafDefaults, DEFAULT_CATEGORIES, DEFAULT_ZONES, diffUnitTree, IMPORT_UNIT_CODES, ROOT_CODE, UNIT_TREE, zoneOfSheet,
} from "./units";

const byCode = new Map(UNIT_TREE.map((u) => [u.code, u]));
const mapOf = (tree: typeof UNIT_TREE) => new Map(tree.map((u) => [u.code, u]));

describe("UNIT_TREE (ตาม Preview_Code)", () => {
  it("หน่วยที่ดึงยอด 86 หน่วย: Sales Zone 76 + Operations 10", () => {
    expect(IMPORT_UNIT_CODES.size).toBe(86);
    expect(UNIT_TREE.filter((u) => u.category === "sales")).toHaveLength(76);
    expect(UNIT_TREE.filter((u) => u.category === "operations")).toHaveLength(10);
  });

  it("MSP → หน่วยงาน MSP Interfood → Zone → Operations (Op) / Sales Zone (Sz) → หน่วย", () => {
    expect(byCode.get(ROOT_CODE)).toMatchObject({ parentCode: null, level: 0 });
    expect(byCode.get("ORG-MSPI")).toMatchObject({ name: "MSP Interfood", parentCode: "MSP", level: 1, category: null });
    for (const z of ["Zone-CMI", "Zone-NAN", "Zone-SU"]) expect(byCode.get(z)).toMatchObject({ parentCode: "ORG-MSPI", level: 2, category: null });
    expect(byCode.get("Op-CMI")).toMatchObject({ name: "Operations (Op) Zone-CMI", parentCode: "Zone-CMI", level: 3 });
    expect(byCode.get("Sz-CMI")).toMatchObject({ name: "Sales Zone (Sz) Zone-CMI", parentCode: "Zone-CMI", level: 3 });
    expect(byCode.get("CM-HO")).toMatchObject({ parentCode: "Op-CMI", level: 4, category: "operations" });
    expect(byCode.get("CM-101")).toMatchObject({ name: "สันป่าตอง", parentCode: "Sz-CMI", level: 4, category: "sales" });
    expect(byCode.get("NAN-HO")?.parentCode).toBe("Op-NAN");
    expect(byCode.get("SU-514")?.parentCode).toBe("Sz-SU");
    expect(byCode.get("FAC-FISH")?.name).toBe("โรงปลาดุก");
  });

  it("ระดับ = ระดับของหน่วยแม่ + 1 · รหัสไม่ซ้ำ · ผังไม่วน · แม่มาก่อนลูก", () => {
    expect(byCode.size).toBe(UNIT_TREE.length);
    expect(() => buildClosure(UNIT_TREE)).not.toThrow();
    const seen = new Set<string>();
    for (const u of UNIT_TREE) {
      if (u.parentCode) {
        expect(seen.has(u.parentCode)).toBe(true);
        expect(u.level).toBe(byCode.get(u.parentCode)!.level + 1);
      }
      seen.add(u.code);
    }
  });
});

describe("หน่วยใหม่ที่ตรวจพบ", () => {
  it("zoneOfSheet: ชีตภูมิภาค → โซน · ชีตงบรวม → null", () => {
    expect(zoneOfSheet("เชียงใหม่_ม.ค.")).toBe("Zone-CMI");
    expect(zoneOfSheet("น่าน_ส.ค.")).toBe("Zone-NAN");
    expect(zoneOfSheet("สุโขทัย_ม.ค.")).toBe("Zone-SU");
    expect(zoneOfSheet("ม.ค.")).toBeNull();
  });

  it("buildUnitTree: เลือกประเภทแล้วเข้าผัง · ยังไม่เลือก/ไม่มีโซน/รหัสชนผังในโค้ด = ไม่เข้าผัง", () => {
    const tree = buildUnitTree([
      { code: "NAN-499", name: "สาขาใหม่", orgCode: null, zoneCode: "Zone-NAN", category: "sales" },
      { code: "FAC-NEW", name: "โรงงานใหม่", orgCode: null, zoneCode: "Zone-CMI", category: "operations" },
      { code: "CM-998", name: "รอเลือก", orgCode: null, zoneCode: "Zone-CMI", category: null },
      { code: "CM-999", name: "ไม่มีโซน", orgCode: null, zoneCode: null, category: "sales" },
      { code: "CM-101", name: "ชนกับผัง", orgCode: null, zoneCode: "Zone-SU", category: "operations" },
    ]);
    const m = mapOf(tree);
    expect(m.get("NAN-499")).toMatchObject({ parentCode: "Sz-NAN", level: 4, category: "sales" });
    expect(m.get("FAC-NEW")).toMatchObject({ parentCode: "Op-CMI", level: 4, category: "operations" });
    expect(m.has("CM-998")).toBe(false);
    expect(m.has("CM-999")).toBe(false);
    expect(m.get("CM-101")?.parentCode).toBe("Sz-CMI");
    expect(tree).toHaveLength(UNIT_TREE.length + 2);
  });
});

describe("ค่าแก้ทับหน่วยในโค้ด (unit_overrides)", () => {
  it("codeLeafDefaults: ค่าตามโค้ดของหน่วยล่างสุด · กลุ่ม/โซนไม่ใช่หน่วยล่างสุด", () => {
    expect(codeLeafDefaults("NAN-HO")).toEqual({ name: "ออฟฟิศน่าน", orgCode: "MSPI", zoneCode: "Zone-NAN", category: "operations" });
    expect(codeLeafDefaults("CM-101")).toEqual({ name: "สันป่าตอง", orgCode: "MSPI", zoneCode: "Zone-CMI", category: "sales" });
    expect(codeLeafDefaults("Sz-CMI")).toBeNull();
    expect(codeLeafDefaults("XX-1")).toBeNull();
  });

  it("buildUnitTree: เปลี่ยนชื่อ/ย้ายโซน/เปลี่ยนประเภท · ค่า null = ตามโค้ด", () => {
    const tree = buildUnitTree([], [
      { code: "CM-101", name: "สันป่าตอง (ใหม่)", orgCode: null, zoneCode: null, category: null },
      { code: "NAN-HO", name: null, orgCode: null, zoneCode: "Zone-SU", category: "sales" },
    ]);
    const m = mapOf(tree);
    expect(m.get("CM-101")).toMatchObject({ name: "สันป่าตอง (ใหม่)", parentCode: "Sz-CMI", category: "sales" });
    expect(m.get("NAN-HO")).toMatchObject({ name: "ออฟฟิศน่าน", parentCode: "Sz-SU", category: "sales", level: 4 });
    expect(tree).toHaveLength(UNIT_TREE.length);
  });
});

describe("ลบหน่วยออกจากผัง", () => {
  it("หน่วยในโค้ดที่ removed ไม่อยู่ในผัง · หน่วยใหม่จากไฟล์ที่ใช้รหัสเดียวกันเข้าผังแทนได้ (เลือกคืน)", () => {
    const removed = { code: "CM-101", name: null, orgCode: null, zoneCode: null, category: null, removed: true };
    expect(mapOf(buildUnitTree([], [removed])).has("CM-101")).toBe(false);
    const restored = buildUnitTree([{ code: "CM-101", name: "สันป่าตอง", orgCode: null, zoneCode: "Zone-NAN", category: "sales" }], [removed]);
    expect(mapOf(restored).get("CM-101")?.parentCode).toBe("Sz-NAN");
  });

  it("หน่วยที่เลือกคืน/เพิ่มจากไฟล์ เรียงตามรหัสในกลุ่ม (ไม่ต่อท้าย)", () => {
    const removed = { code: "CM-101", name: null, orgCode: null, zoneCode: null, category: null, removed: true };
    const tree = buildUnitTree(
      [
        { code: "CM-101", name: "สันป่าตอง", orgCode: null, zoneCode: "Zone-CMI", category: "sales" },
        { code: "CM-110", name: "ใหม่", orgCode: null, zoneCode: "Zone-CMI", category: "sales" },
      ],
      [removed],
    );
    const sales = tree.filter((u) => u.parentCode === "Sz-CMI").map((u) => u.code);
    expect(sales.slice(0, 4)).toEqual(["CM-101", "CM-102", "CM-103", "CM-104"]);
    expect(sales.indexOf("CM-110")).toBe(sales.indexOf("CM-109") + 1);
    // sortOrder ตามลำดับในผัง (Dashboard/ช่องเลือกหน่วยเรียงตามค่านี้)
    const order = tree.filter((u) => u.parentCode === "Sz-CMI").map((u) => u.sortOrder);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("หลายหน่วยงาน", () => {
  const orgs = [{ code: "O2", name: "บริษัทใหม่" }];

  it("ย้ายหน่วยไปหน่วยงานอื่น: สร้างโซน/กลุ่มของหน่วยงานนั้นเฉพาะที่มีหน่วย (รหัสมีหน่วยงานนำหน้า)", () => {
    const tree = buildUnitTree([], [{ code: "CM-101", name: null, orgCode: "O2", zoneCode: null, category: null }], orgs);
    const m = mapOf(tree);
    expect(m.get("ORG-O2")).toMatchObject({ name: "บริษัทใหม่", parentCode: "MSP", level: 1 });
    expect(m.get("O2-Zone-CMI")).toMatchObject({ name: "Zone-CMI · บริษัทใหม่", parentCode: "ORG-O2", level: 2 });
    expect(m.get("O2-Sz-CMI")).toMatchObject({ name: "Sales Zone (Sz) Zone-CMI · บริษัทใหม่", parentCode: "O2-Zone-CMI", level: 3 });
    expect(m.get("CM-101")).toMatchObject({ parentCode: "O2-Sz-CMI", level: 4 });
    expect(m.has("O2-Op-CMI")).toBe(false);
    expect(m.has("O2-Zone-NAN")).toBe(false);
    // หน่วยงานเริ่มต้นยังมีกลุ่มครบ
    expect(m.get("Sz-CMI")?.parentCode).toBe("Zone-CMI");
    expect(() => buildClosure(tree)).not.toThrow();
  });

  it("หน่วยงานที่ถูกลบ/ไม่รู้จัก → อยู่หน่วยงานเริ่มต้น", () => {
    const tree = buildUnitTree([], [{ code: "CM-101", name: null, orgCode: "O9", zoneCode: null, category: null }], orgs);
    expect(mapOf(tree).get("CM-101")?.parentCode).toBe("Sz-CMI");
  });
});

describe("โซน/ประเภทที่ผู้ดูแลแก้ (ตาราง zones / unit_categories)", () => {
  const ws = { code: "Ws", prefix: "Ws", name: "ค้าส่ง", page: "operations" as const };
  const pyo = { code: "Zone-PYO", key: "PYO", name: "Zone-PYO", label: "โซนพะเยา", sheetPrefix: "พะเยา" };

  it("ประเภทใหม่: มีกลุ่มของตัวเองเฉพาะโซนที่มีหน่วย · หน่วยเก็บ category = หน้าที่แสดง", () => {
    const tree = buildUnitTree([], [{ code: "CM-101", name: null, orgCode: null, zoneCode: null, category: "Ws" }], [], undefined, [
      ...DEFAULT_CATEGORIES, ws,
    ]);
    const m = mapOf(tree);
    expect(m.get("Ws-CMI")).toMatchObject({ name: "ค้าส่ง (Ws) Zone-CMI", parentCode: "Zone-CMI", level: 3 });
    expect(m.get("CM-101")).toMatchObject({ parentCode: "Ws-CMI", category: "operations" });
    expect(m.has("Ws-NAN")).toBe(false);
    expect(() => buildClosure(tree)).not.toThrow();
  });

  it("แก้ชื่อประเภทเริ่มต้น → ชื่อกลุ่มเปลี่ยน รหัสกลุ่มเดิม", () => {
    const renamed = DEFAULT_CATEGORIES.map((c) => (c.code === "sales" ? { ...c, name: "สาขาขาย" } : c));
    expect(mapOf(buildUnitTree([], [], [], undefined, renamed)).get("Sz-CMI")?.name).toBe("สาขาขาย (Sz) Zone-CMI");
  });

  it("โซนใหม่: หน่วยงานเริ่มต้นมีโซนและกลุ่มเริ่มต้นแม้ยังไม่มีหน่วย · หน่วยใหม่จากไฟล์เข้าโซนนั้นได้ · เดาโซนจากชื่อชีต", () => {
    const zones = [...DEFAULT_ZONES, pyo];
    const tree = buildUnitTree([{ code: "PY-1", name: "พะเยา 1", orgCode: null, zoneCode: "Zone-PYO", category: "sales" }], [], [], zones);
    const m = mapOf(tree);
    expect(m.get("Zone-PYO")).toMatchObject({ parentCode: "ORG-MSPI", level: 2 });
    expect(m.get("Op-PYO")?.parentCode).toBe("Zone-PYO");
    expect(m.get("PY-1")).toMatchObject({ parentCode: "Sz-PYO", category: "sales" });
    expect(zoneOfSheet("พะเยา_ม.ค.", zones)).toBe("Zone-PYO");
  });

  it("โซนที่ถูกลบ → หน่วยในโซนนั้นไม่อยู่ในผัง (ปกติต้องย้ายออกก่อนลบ)", () => {
    const zones = DEFAULT_ZONES.filter((z) => z.code !== "Zone-SU");
    const m = mapOf(buildUnitTree([], [], [], zones));
    expect(m.has("Zone-SU")).toBe(false);
    expect(m.has("SU-501")).toBe(false);
    expect(m.has("CM-101")).toBe(true);
  });
});

describe("diffUnitTree", () => {
  it("หน่วยผังเดิมที่ไม่อยู่ในผังใหม่ = ลบ · ชื่อ/หน่วยแม่ต่าง = แก้ · ไม่มีในฐานข้อมูล = เพิ่ม", () => {
    const existing = [
      { code: "MSP", name: "MSP Interfood", parentCode: null, category: null },
      { code: "CMI-SHOP", name: "สาขาเชียงใหม่", parentCode: "MSP", category: null },
      { code: "CM-101", name: "สันป่าตอง", parentCode: "CMI-SHOP", category: null },
    ];
    const change = diffUnitTree(existing);
    expect(change.removed).toEqual([{ code: "CMI-SHOP", name: "สาขาเชียงใหม่" }]);
    expect(change.updated.map((u) => u.code)).toEqual(["MSP", "CM-101"]);
    expect(change.added).toHaveLength(UNIT_TREE.length - 2);
  });

  it("ผังเหมือนกันทุกอย่าง → ไม่มีการเปลี่ยนแปลง", () => {
    expect(diffUnitTree(UNIT_TREE)).toEqual({ added: [], removed: [], updated: [] });
  });
});
