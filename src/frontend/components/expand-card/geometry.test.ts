import { describe, expect, it } from "vitest";
import { panelWidth, placePanel } from "./geometry";

describe("panelWidth", () => {
  it("ขยายจากการ์ดราว 20%", () => {
    expect(panelWidth(335, 1440)).toBe(402);
  });

  it("การ์ดกว้าง (2 คอลัมน์) ยังขยายกว่าเดิม แต่ไม่กว้างเกิน", () => {
    expect(panelWidth(476, 1023)).toBe(508);
  });

  it("การ์ดแคบยังกว้างพอให้กราฟอ่านได้ · ไม่เกินจอ", () => {
    expect(panelWidth(285, 640)).toBe(352);
    expect(panelWidth(343, 375)).toBe(351);
  });
});

describe("placePanel", () => {
  const view = { width: 1440, height: 900, top: 64 };

  it("กึ่งกลางตรงการ์ด ยื่นเหนือการ์ดเล็กน้อย แล้วขยายลงล่าง", () => {
    expect(placePanel({ left: 100, top: 300, width: 300, height: 130 }, { width: 360, height: 350 }, view)).toEqual({ x: -30, y: -10 });
  });

  it("ไม่ล้นขอบจอซ้ายขวา", () => {
    expect(placePanel({ left: 1100, top: 300, width: 300, height: 130 }, { width: 360, height: 350 }, view).x).toBe(-32);
    expect(placePanel({ left: 16, top: 300, width: 343, height: 130 }, { width: 351, height: 350 }, { width: 375, height: 800, top: 64 }).x).toBe(-4);
  });

  it("ด้านล่างไม่พอ ขยายขึ้นบนแทน (ไม่ทับแถบเมนูบน)", () => {
    expect(placePanel({ left: 100, top: 600, width: 300, height: 130 }, { width: 360, height: 350 }, { width: 1440, height: 800, top: 64 })).toEqual({ x: -30, y: -210 });
  });

  it("ไม่พอทั้งบนและล่าง เลือกด้านที่ที่ว่างมากกว่า", () => {
    expect(placePanel({ left: 100, top: 200, width: 300, height: 130 }, { width: 360, height: 700 }, { width: 1440, height: 600, top: 64 }).y).toBe(-10);
    expect(placePanel({ left: 100, top: 420, width: 300, height: 130 }, { width: 360, height: 700 }, { width: 1440, height: 600, top: 64 }).y).toBe(-560);
  });

  it("ชิดขวาและขยายขึ้นบน (การ์ดเล็กมุมล่างขวา): มุมล่างขวาตรึงกับการ์ดเดิม", () => {
    const chip = { left: 900, top: 700, width: 120, height: 40 };
    expect(placePanel(chip, { width: 340, height: 300 }, view, { x: "end", y: "up" }, 12)).toEqual({ x: -208, y: -248 });
  });

  it("ขยายขึ้นบนไม่พอ (การ์ดอยู่บนสุดของจอ) สลับลงล่าง", () => {
    const chip = { left: 900, top: 120, width: 120, height: 40 };
    expect(placePanel(chip, { width: 340, height: 300 }, view, { x: "end", y: "up" }, 12).y).toBe(-12);
  });
});
