import { describe, expect, it } from "vitest";
import { formatBaht, formatMillions, formatPct, formatPeriod } from "./format";

describe("format", () => {
  it("แสดงงวดเป็นเดือนไทยและปี พ.ศ.", () => {
    expect(formatPeriod("2026-01-01")).toBe("มกราคม 2569");
    expect(formatPeriod("2025-12-01", "short")).toBe("ธ.ค. 68");
  });

  it("แสดงยอดเงินเป็นล้านบาท", () => {
    expect(formatMillions(361556532.08)).toBe("361.6");
    expect(formatMillions(-48101.45)).toBe("-0.05");
    expect(formatMillions(0)).toBe("0");
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
