import { describe, expect, it } from "vitest";
import { formatPeriods, shiftPeriod } from "./format";

describe("งวดหลายเดือน", () => {
  it("เลื่อนงวดข้ามปีได้", () => {
    expect(shiftPeriod("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2026-02-01", -2)).toBe("2025-12-01");
    expect(shiftPeriod("2025-11-01", 3)).toBe("2026-02-01");
  });

  it("ตั้งชื่องวดตามรูปแบบที่เลือก", () => {
    expect(formatPeriods(["2026-08-01"])).toBe("สิงหาคม 2569");
    expect(formatPeriods(["2026-02-01", "2026-01-01"])).toBe("ม.ค. – ก.พ. 69 (รวม 2 เดือน)");
    expect(formatPeriods(["2026-01-01", "2026-03-01"])).toBe("ม.ค., มี.ค. 69 (รวม 2 เดือน)");
    expect(formatPeriods(["2026-01-01", "2026-02-01", "2026-03-01"], true)).toBe("ทุกเดือน · ม.ค. – มี.ค. 69");
  });
});
