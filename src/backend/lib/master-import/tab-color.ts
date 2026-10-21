import type ExcelJS from "exceljs";

// สีแท็บชีตใน Excel เก็บได้ 2 แบบ: argb ตรงๆ หรือ "สีธีม + tint" (เช่น Blue, Accent 1, Darker 50% = theme 4, tint -0.5)
// จึงต้องแปลงเป็น hex จริงก่อนเทียบ

/** สีธีม Office มาตรฐาน — ใช้เมื่อไฟล์ไม่มี theme XML */
const OFFICE_THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];

// ลำดับ index ของ theme color ใน Excel: lt1, dk1, lt2, dk2, accent1–6, hlink, folHlink (สลับคู่แรกจากลำดับใน XML)
const THEME_SLOTS = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

export function themePalette(themeXml: string | undefined): string[] {
  if (!themeXml) return OFFICE_THEME;
  return THEME_SLOTS.map((slot, i) => {
    const block = themeXml.match(new RegExp(`<a:${slot}>([\\s\\S]*?)</a:${slot}>`))?.[1] ?? "";
    // sysClr (windowText/window) เก็บสีจริงไว้ใน lastClr
    const hex = block.match(/(?:lastClr|val)="([0-9A-Fa-f]{6})"/)?.[1];
    return (hex ?? OFFICE_THEME[i]).toUpperCase();
  });
}

// Excel คิด tint บนค่า HLS แบบจำนวนเต็มสเกล 0–240 (อัลกอริทึม ColorRGBToHLS/HLSToRGB ของ Windows)
// ถ้าใช้ HSL ทศนิยมทั่วไปจะคลาดไป 1 หน่วย เช่นได้ #203864 แทน #203764
const HLSMAX = 240;
const RGBMAX = 255;
const div = (a: number, b: number) => Math.trunc(a / b);

function rgbToHls(r: number, g: number, b: number): [h: number, l: number, s: number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = div((max + min) * HLSMAX + RGBMAX, 2 * RGBMAX);
  if (max === min) return [div(HLSMAX * 2, 3), l, 0];
  const s = l <= HLSMAX / 2
    ? div((max - min) * HLSMAX + div(max + min, 2), max + min)
    : div((max - min) * HLSMAX + div(2 * RGBMAX - max - min, 2), 2 * RGBMAX - max - min);
  const delta = (c: number) => div((max - c) * div(HLSMAX, 6) + div(max - min, 2), max - min);
  let h = r === max ? delta(b) - delta(g) : g === max ? div(HLSMAX, 3) + delta(r) - delta(b) : div(2 * HLSMAX, 3) + delta(g) - delta(r);
  if (h < 0) h += HLSMAX;
  if (h > HLSMAX) h -= HLSMAX;
  return [h, l, s];
}

function hueToRgb(n1: number, n2: number, hue: number): number {
  if (hue < 0) hue += HLSMAX;
  if (hue > HLSMAX) hue -= HLSMAX;
  if (hue < div(HLSMAX, 6)) return n1 + div((n2 - n1) * hue + div(HLSMAX, 12), div(HLSMAX, 6));
  if (hue < div(HLSMAX, 2)) return n2;
  if (hue < div(HLSMAX * 2, 3)) return n1 + div((n2 - n1) * (div(HLSMAX * 2, 3) - hue) + div(HLSMAX, 12), div(HLSMAX, 6));
  return n1;
}

function hlsToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) {
    const v = div(l * RGBMAX, HLSMAX);
    return [v, v, v];
  }
  const m2 = l <= HLSMAX / 2 ? div(l * (HLSMAX + s) + div(HLSMAX, 2), HLSMAX) : l + s - div(l * s + div(HLSMAX, 2), HLSMAX);
  const m1 = 2 * l - m2;
  const channel = (hue: number) => div(hueToRgb(m1, m2, hue) * RGBMAX + div(HLSMAX, 2), HLSMAX);
  return [channel(h + div(HLSMAX, 3)), channel(h), channel(h - div(HLSMAX, 3))];
}

/** ปรับความสว่างตาม tint แบบเดียวกับ Excel (tint < 0 = เข้มลง, > 0 = อ่อนลง) */
export function applyTint(hex: string, tint: number): string {
  if (!tint) return hex.toUpperCase();
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [h, l, s] = rgbToHls(r, g, b);
  const tinted = Math.trunc(tint < 0 ? l * (1 + tint) : l * (1 - tint) + HLSMAX * tint);
  return hlsToRgb(h, Math.min(HLSMAX, Math.max(0, tinted)), s)
    .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** สีแท็บของชีตเป็น "#RRGGBB" หรือ null ถ้าไม่ได้ตั้งสี */
export function tabColorOf(ws: ExcelJS.Worksheet, palette: string[]): string | null {
  const c = ws.properties.tabColor as { argb?: string; theme?: number; tint?: number } | undefined;
  if (!c) return null;
  if (c.argb) return `#${c.argb.slice(-6).toUpperCase()}`;
  if (c.theme != null && palette[c.theme]) return `#${applyTint(palette[c.theme], c.tint ?? 0)}`;
  return null;
}

/** อ่าน theme XML ของไฟล์ (exceljs เก็บไว้ใน _themes แต่ไม่ได้ประกาศใน type) */
export function workbookPalette(book: ExcelJS.Workbook): string[] {
  const themes = (book as unknown as { _themes?: Record<string, string> })._themes;
  return themePalette(themes?.theme1);
}
