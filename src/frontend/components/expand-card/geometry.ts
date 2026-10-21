// ตำแหน่งและขนาดของการ์ดที่ขยาย (ExpandCard) — ฟังก์ชันล้วน ไม่แตะ DOM

/** ระยะห่างขอบจอขั้นต่ำ */
export const GUTTER = 12;
/** การ์ดที่ขยายยื่นพ้นการ์ดเดิมด้านที่ยึดเล็กน้อย ให้ดูเหมือนขยายออกทุกทิศ */
export const LIFT = 10;

export type Box = { left: number; top: number; width: number; height: number };
/** พื้นที่ที่วางได้: ทั้งจอ ใต้ขอบล่างของแถบเมนูบน (top) */
export type View = { width: number; height: number; top: number };
/** ทิศที่ขยาย: x = กึ่งกลางการ์ด หรือชิดขวา (ขยายไปทางซ้าย) · y = ลงล่าง หรือขึ้นบน — ที่ไม่พอ สลับด้านให้เอง */
export type Place = { x: "center" | "end"; y: "down" | "up" };

/** ความกว้างแบบการ์ด KPI: ขยายจากการ์ดราว 20% (การ์ดแคบยังกว้างพอให้กราฟอ่านได้ การ์ดกว้างขยายแค่พอดี) ไม่เกินจอ */
export function panelWidth(tile: number, view: number): number {
  const want = Math.max(tile * 1.2, 352);
  const cap = Math.max(460, tile + 32);
  return Math.round(Math.min(want, cap, view - GUTTER * 2));
}

/**
 * ตำแหน่งการ์ดที่ขยาย เทียบมุมซ้ายบนของการ์ดเดิม — ไม่ล้นขอบจอ และไม่ขึ้นไปทับแถบเมนูบน
 * ทิศที่ต้องการไม่พอ แต่อีกด้านพอ (หรือที่ว่างมากกว่า) สลับไปอีกด้าน
 */
export function placePanel(tile: Box, panel: { width: number; height: number }, view: View, place: Place = { x: "center", y: "down" }, lift = LIFT): { x: number; y: number } {
  const wanted = place.x === "end" ? tile.left + tile.width + lift - panel.width : tile.left + (tile.width - panel.width) / 2;
  const left = Math.max(GUTTER, Math.min(wanted, view.width - GUTTER - panel.width));
  const down = tile.top - lift;
  const up = tile.top + tile.height + lift - panel.height;
  const fitsDown = down + panel.height <= view.height - GUTTER;
  const fitsUp = up >= view.top + GUTTER;
  const roomAbove = tile.top + tile.height - view.top;
  const roomBelow = view.height - tile.top;
  const goUp = place.y === "up" ? fitsUp || (!fitsDown && roomAbove >= roomBelow) : !fitsDown && (fitsUp || roomAbove > roomBelow);
  // ไม่ปัดเศษ: ตำแหน่งการ์ดเดิมมักเป็นทศนิยม การ์ดที่ขยายต้องทับพอดีตอนเริ่ม
  return { x: left - tile.left, y: (goUp ? up : down) - tile.top };
}
