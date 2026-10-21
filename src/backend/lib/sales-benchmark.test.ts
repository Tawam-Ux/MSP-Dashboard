import { describe, expect, it } from "vitest";
import { branchAreas, groupAmounts } from "@/backend/db/schema";
import { branchPerSqm, computeSalesBenchmark, diffBranchAreas, salesAreaMonths } from "./sales-benchmark";

/** db ปลอม: select().from(ตาราง).where() คืนแถวของตารางนั้น (เงื่อนไข where ไม่ถูกตรวจ — แถวที่ส่งมาคือผลลัพธ์) */
function fakeDb(rows: { sold: { period: string; code: string; amount: string }[]; areas: { code: string; area: string }[] }) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === groupAmounts ? rows.sold : table === branchAreas ? rows.areas : []),
      }),
    }),
  } as unknown as Parameters<typeof salesAreaMonths>[0];
}

describe("ตร.ม.×เดือน เมื่อเลือกหลายเดือน (สาขาที่เปิดกลางช่วง)", () => {
  const periods = ["2026-06-01", "2026-07-01", "2026-08-01"];

  it("นับ ตร.ม. เฉพาะเดือนที่สาขามียอดขาย — สาขาเปิด ส.ค. ไม่ถูกหารด้วย มิ.ย.–ก.ค.", async () => {
    const db = fakeDb({
      sold: [
        { period: "2026-06-01", code: "OLD", amount: "300000" },
        { period: "2026-07-01", code: "OLD", amount: "300000" },
        { period: "2026-08-01", code: "OLD", amount: "300000" },
        { period: "2026-08-01", code: "NEW", amount: "100000" },
      ],
      areas: [{ code: "OLD", area: "100" }, { code: "NEW", area: "50" }],
    });
    const m = await salesAreaMonths(db, periods, ["OLD", "NEW"]);
    expect(m.get("OLD")).toBe(300);
    expect(m.get("NEW")).toBe(50);
    // เกณฑ์ = บาท/ตร.ม./เดือน: (900,000 + 100,000) ÷ (300 + 50)
    const b = computeSalesBenchmark([
      { code: "OLD", salesA: 900_000, area: m.get("OLD")! },
      { code: "NEW", salesA: 100_000, area: m.get("NEW")! },
    ]);
    expect(b.perSqm).toBeCloseTo(1_000_000 / 350);
    expect(branchPerSqm(100_000, m.get("NEW"))).toBe(2_000); // เท่ากับเดือนเดียวของสาขานั้น
  });

  it("เดือนที่ยอดขาย ≤ 0 ไม่นับ · ไม่มี ตร.ม. = null (เทียบไม่ได้)", async () => {
    const db = fakeDb({
      sold: [
        { period: "2026-06-01", code: "A", amount: "0" },
        { period: "2026-07-01", code: "A", amount: "5000" },
        { period: "2026-07-01", code: "B", amount: "5000" },
      ],
      areas: [{ code: "A", area: "10" }],
    });
    const m = await salesAreaMonths(db, periods, ["A", "B"]);
    expect(m.get("A")).toBe(10);
    expect(m.get("B")).toBeNull();
  });
});

describe("เกณฑ์รายได้จากการขายต่อ ตร.ม.", () => {
  it("รวม Group A ÷ รวม ตร.ม. (ไม่ใช่ค่าเฉลี่ยของแต่ละสาขา)", () => {
    const b = computeSalesBenchmark([
      { code: "A1", salesA: 900_000, area: 100 }, // 9,000/ตร.ม.
      { code: "A2", salesA: 300_000, area: 200 }, // 1,500/ตร.ม.
    ]);
    expect(b).toEqual({ salesA: 1_200_000, area: 300, branchCount: 2, perSqm: 4_000 });
  });

  it("นับเฉพาะสาขาที่มี Group A > 0 และมี ตร.ม. — ตร.ม. ของสาขาที่ไม่มียอดขายไม่ถูกนำมาหาร", () => {
    const b = computeSalesBenchmark([
      { code: "A", salesA: 500_000, area: 100 },
      { code: "B", salesA: 0, area: 400 }, // ไม่มีรายได้จากการขาย
      { code: "C", salesA: -10, area: 50 }, // ติดลบ (ปรับปรุงบัญชี) ไม่นับ
      { code: "D", salesA: 800_000, area: null }, // ไม่มีข้อมูล ตร.ม.
    ]);
    expect(b).toEqual({ salesA: 500_000, area: 100, branchCount: 1, perSqm: 5_000 });
  });

  it("ไม่มีสาขาที่นับได้ → ไม่มีเกณฑ์", () => {
    expect(computeSalesBenchmark([{ code: "D", salesA: 800_000, area: null }]).perSqm).toBeNull();
    expect(computeSalesBenchmark([]).perSqm).toBeNull();
  });

  it("รายได้ต่อ ตร.ม. ของสาขา · ไม่มี ตร.ม. = null", () => {
    expect(branchPerSqm(900_000, 100)).toBe(9_000);
    expect(branchPerSqm(900_000, null)).toBeNull();
    expect(branchPerSqm(900_000, 0)).toBeNull();
  });
});

describe("ตร.ม. ที่เปลี่ยนเมื่อนำเข้าชีต Branch_Area", () => {
  it("คืนเฉพาะที่แก้ค่า เพิ่มใหม่ และไม่มีในไฟล์ (ค่าเท่าเดิมที่ทศนิยม 2 ตำแหน่งไม่นับ)", () => {
    const saved = [
      { code: "CM-101", name: "สันป่าตอง", area: 96, source: "file" as const },
      { code: "CM-102", name: "กาดเมืองใหม่", area: 64, source: "admin" as const },
      { code: "CM-103", name: "แม่ริม", area: 100, source: "file" as const },
    ];
    const incoming = [
      { code: "CM-101", name: "สันป่าตอง", area: 150 },
      { code: "CM-102", name: "กาดเมืองใหม่", area: 64.001 },
      { code: "CM-999", name: "", area: 120 },
    ];
    expect(diffBranchAreas(saved, incoming)).toEqual([
      { code: "CM-101", name: "สันป่าตอง", before: 96, after: 150, source: "file" },
      { code: "CM-999", name: "", before: null, after: 120, source: null },
      { code: "CM-103", name: "แม่ริม", before: 100, after: null, source: "file" },
    ]);
  });
});
