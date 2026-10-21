// อ่านไฟล์ตัวอย่างจริง แล้วเทียบยอดที่ระบบคำนวณกับยอดรวมในชีตงบ (ไฟล์ไม่อยู่ใน git — ไม่มีไฟล์ = ข้าม)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeTotals, rollup } from "./compute";
import { parseStatementWorkbook } from "./parse";
import { IMPORT_UNIT_CODES, UNIT_TREE } from "./units";

const FILE = path.resolve(import.meta.dirname, "../../../../PreView_ForClaude/MSP-P_Lเชียงใหม่ 2026_08.xlsx");

describe.skipIf(!existsSync(FILE))("ไฟล์ตัวอย่าง MSP-P_Lเชียงใหม่ 2026_08.xlsx", async () => {
  const parsed = await parseStatementWorkbook(readFileSync(FILE));

  it("อ่านชีตสี #002060 ได้เดือน ม.ค. และทุกยอดรวมตรงกับไฟล์", () => {
    expect(parsed.months.map((m) => m.month)).toEqual([1]);
    expect(parsed.unknownGroups).toEqual([]);
    expect(parsed.mismatches).toEqual([]);
  });

  it("ดึงครบทุกหน่วยในผัง (Preview_Code) และไม่มีหน่วยนอกผัง", () => {
    expect([...parsed.months[0].units.keys()].sort()).toEqual([...IMPORT_UNIT_CODES].sort());
    expect(parsed.newUnits).toEqual([]);
    expect(parsed.missingUnits).toEqual([]);
  });

  it("ยอดรวมทั้งบริษัทตามผังใหม่ตรงกับชีต ม.ค. คอลัมน์ C", () => {
    const all = rollup(UNIT_TREE, parsed.months[0].units);
    const t = computeTotals(all.get("MSP") ?? {});
    expect(t.REV).toBeCloseTo(361556532.08, 2);
    expect(t.GP).toBeCloseTo(68001955.47, 2);
    expect(t.OP).toBeCloseTo(21037808.54, 2);
    expect(t.PBT).toBeCloseTo(17217467.63, 2);
    const pbt = (code: string) => computeTotals(all.get(code) ?? {}).PBT;
    // Sales Zone ของเชียงใหม่ = รวมสาขาเชียงใหม่ (ชีตเชียงใหม่ คอลัมน์ C)
    expect(pbt("Sz-CMI")).toBeCloseTo(22185730.14, 2);
    // Zone-NAN / Zone-SU = ยอดรวมชีตน่าน / สุโขทัย (ออฟฟิศ + สาขา) · ทุกโซนรวมกัน = ทั้งบริษัท
    expect(pbt("Zone-NAN")).toBeCloseTo(pbt("Op-NAN") + pbt("Sz-NAN"), 2);
    expect(pbt("Zone-CMI") + pbt("Zone-NAN") + pbt("Zone-SU")).toBeCloseTo(17217467.63, 2);
  });
});
