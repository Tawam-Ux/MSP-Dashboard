import { describe, expect, it } from "vitest";
import { formatBaht, formatBahtCompact, formatBahtDecimal, formatMoney, formatPct, formatPeriod, parseMoneyMode } from "./format";

describe("format", () => {
  it("แสดงงวดเป็นเดือนไทยและปี พ.ศ.", () => {
    expect(formatPeriod("2026-01-01")).toBe("มกราคม 2569");
    expect(formatPeriod("2025-12-01", "short")).toBe("ธ.ค. 68");
  });

  it("แสดงยอดเงินมีทศนิยม 2 ตำแหน่ง", () => {
    expect(formatBahtDecimal(17217467.63)).toBe("17,217,467.63");
    expect(formatBahtDecimal(-15576.6)).toBe("-15,576.60");
    expect(formatBahtDecimal(0)).toBe("0.00");
  });

  it("แสดงยอดเงินแบบย่อ K/M", () => {
    expect(formatBahtCompact(361556532.08)).toBe("361.56M");
    expect(formatBahtCompact(-48101.45)).toBe("-48.1K");
    expect(formatBahtCompact(1000)).toBe("1K");
    expect(formatBahtCompact(950.4)).toBe("950");
    expect(formatBahtCompact(0)).toBe("0");
  });

  it("เลือกรูปแบบตามค่าใน cookie — ค่าเก่า (ล้านบาท) กลับเป็นปกติ", () => {
    expect(parseMoneyMode("decimal")).toBe("decimal");
    expect(parseMoneyMode("compact")).toBe("compact");
    expect(parseMoneyMode("m")).toBe("full");
    expect(parseMoneyMode(undefined)).toBe("full");
    expect(formatMoney(1234567.891, "full")).toBe("1,234,568");
    expect(formatMoney(1234567.891, "decimal")).toBe("1,234,567.89");
    expect(formatMoney(1234567.891, "compact")).toBe("1.23M");
  });

  it("แสดงยอดเงินเต็มจำนวนไม่มีทศนิยม", () => {
    expect(formatBaht(17217467.63)).toBe("17,217,468");
    expect(formatBaht(-15576.6)).toBe("-15,577");
  });

  it("แสดงเปอร์เซ็นต์ 1 ตำแหน่ง และขีดเมื่อไม่มีค่า", () => {
    expect(formatPct(4.7621)).toBe("4.8%");
    expect(formatPct(null)).toBe("—");
  });
});
