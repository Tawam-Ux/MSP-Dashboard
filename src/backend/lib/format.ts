const MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const MONTHS_SHORT =["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-01-01" → "มกราคม 2569" (ปี พ.ศ.) */
export function formatPeriod(period: string, style: "long" | "short" = "long"): string {
  const [y, m] = period.split("-").map(Number);
  const be = y + 543;
  return style === "long" ? `${MONTHS_LONG[m - 1]} ${be}` : `${MONTHS_SHORT[m - 1]} ${String(be).slice(-2)}`;
}

/** เลขเดือนต่อเนื่อง (ปี×12 + เดือน) ใช้ตรวจว่างวดติดกันหรือไม่ */
const monthIndex = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return y * 12 + m - 1;
};

/** เลื่อนงวดไป n เดือน (ติดลบ = ย้อนหลัง) — "2026-01-01", -1 → "2025-12-01" */
export function shiftPeriod(period: string, n: number): string {
  const i = monthIndex(period) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`;
}

/**
 * ชื่อของงวดที่เลือก (หนึ่งเดือนหรือรวมหลายเดือน)
 * 1 เดือน → "สิงหาคม 2569" · ติดกัน → "ม.ค. – มี.ค. 69 (รวม 3 เดือน)" · ไม่ติดกัน → "ม.ค., มี.ค. 69 (รวม 2 เดือน)"
 * ทุกงวดที่มี (all) → "ทุกเดือน · ม.ค. – ส.ค. 69"
 */
export function formatPeriods(selected: string[], all = false): string {
  const list = [...selected].sort();
  if (list.length === 0) return "—";
  if (list.length === 1) return formatPeriod(list[0]);
  if (all) return `ทุกเดือน · ${formatPeriodRange(list)}`;
  const contiguous = list.every((p, i) => i === 0 || monthIndex(p) === monthIndex(list[i - 1]) + 1);
  if (contiguous) return `${formatPeriodRange(list)} (รวม ${list.length} เดือน)`;
  const sameYear = list.every((p) => p.slice(0, 4) === list[0].slice(0, 4));
  const names = sameYear
    ? `${list.map((p) => MONTHS_SHORT[Number(p.slice(5, 7)) - 1]).join(", ")} ${String(Number(list[0].slice(0, 4)) + 543).slice(-2)}`
    : list.map((p) => formatPeriod(p, "short")).join(", ");
  return `${names} (รวม ${list.length} เดือน)`;
}

/** ["2026-01-01", ..., "2026-08-01"] → "ม.ค. – ส.ค. 69" · ข้ามปี → "พ.ย. 68 – ก.พ. 69" · เดือนเดียว → "ส.ค. 69" */
export function formatPeriodRange(periods: string[]): string {
  if (periods.length === 0) return "—";
  const first = formatPeriod(periods[0], "short");
  const last = formatPeriod(periods[periods.length - 1], "short");
  if (periods.length === 1) return last;
  return first.slice(-2) === last.slice(-2) ? `${first.slice(0, -3)} – ${last}` : `${first} – ${last}`;
}

const baht = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatBaht(n: number): string {
  return baht.format(Math.round(n));
}

const bahtDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** บาทมีทศนิยม 2 ตำแหน่ง: 17,217,467.63 */
export function formatBahtDecimal(n: number): string {
  return bahtDecimal.format(n);
}

const bahtCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

/** บาทแบบย่อ: 1.25K · 361.56M · 1.2B · ต่ำกว่าพันแสดงเต็ม (950) */
export function formatBahtCompact(n: number): string {
  return bahtCompact.format(Math.round(n));
}

export function formatPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

/** % ที่ติดลบใช้เครื่องหมายลบจริง (−) แบบเดียวกับยอดเงินที่ติดลบในหน้า Overview */
export function formatSignedPct(n: number | null): string {
  return formatPct(n).replace(/^-/, "−");
}

/** รูปแบบตัวเลขเงิน (หน่วยเป็นบาททุกแบบ) — เก็บใน cookie */
export const MONEY_MODES = ["full", "decimal", "compact"] as const;
export type MoneyMode = (typeof MONEY_MODES)[number];
export const MONEY_COOKIE = "money_format";

/** ตารางงบรายเดือน (หน้า Overview) แสดงเป็นยอดเงินหรือ % ของรายได้ — เก็บใน cookie แบบเดียวกับรูปแบบตัวเลข */
export type MatrixShow = "amount" | "pct";
export const MATRIX_SHOW_COOKIE = "matrix_show";
export const parseMatrixShow = (value: string | undefined): MatrixShow => (value === "pct" ? "pct" : "amount");

/** ค่าใน cookie → รูปแบบ · ค่าเก่า ("m" = ล้านบาท ที่เลิกใช้แล้ว) หรือไม่รู้จัก = บาทเต็ม */
export function parseMoneyMode(value: string | undefined): MoneyMode {
  return MONEY_MODES.find((m) => m === value) ?? "full";
}

/** full = 17,217,468 · decimal = 17,217,467.63 · compact = 17.22M */
export function formatMoney(n: number, mode: MoneyMode): string {
  return mode === "decimal" ? formatBahtDecimal(n) : mode === "compact" ? formatBahtCompact(n) : formatBaht(n);
}