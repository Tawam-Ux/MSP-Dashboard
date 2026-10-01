import { describe, expect, it } from "vitest";
import { ACCOUNTS, computeStatement, STATEMENT } from "./statement";

describe("ACCOUNTS", () => {
  it("มีรหัสบัญชีไม่ซ้ำ และครอบคลุมทุกรหัสที่ STATEMENT ใช้", () => {
    const codes = ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const line of STATEMENT) {
      if (line.kind === "account") expect(codes).toContain(line.code);
    }
  });
});

describe("computeStatement", () => {
  it("คำนวณยอดรวมตามสูตรงบกำไรขาดทุน", () => {
    const s = computeStatement({ A: 1000, C: 50, AA: 200, D: 600, AB: 100, N: 30, R: 70, ZZ: 10, ZZZ: 5 });
    expect(s.totals.REV).toBe(1050);
    expect(s.totals.COGS).toBe(700);
    expect(s.totals.GP).toBe(350);
    expect(s.totals.SGA).toBe(100);
    expect(s.totals.OP).toBe(250);
    expect(s.totals.PBT).toBe(235);
  });

  it("บัญชีที่ไม่มีข้อมูลนับเป็น 0", () => {
    const s = computeStatement({});
    expect(s.totals.PBT).toBe(0);
    expect(s.lines.find((l) => l.kind === "account" && l.code === "A")?.value).toBe(0);
  });

  it("คิด % ต่อรายได้รวม และเป็น null เมื่อรายได้เป็น 0", () => {
    const s = computeStatement({ A: 200, R: 50 });
    expect(s.lines.find((l) => l.kind === "total" && l.key === "ADMIN")?.pctOfRevenue).toBe(25);
    expect(computeStatement({ R: 50 }).lines.find((l) => l.kind === "total" && l.key === "ADMIN")?.pctOfRevenue).toBeNull();
  });
});
