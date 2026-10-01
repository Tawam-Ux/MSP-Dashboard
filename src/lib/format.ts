const MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-01-01" → "มกราคม 2569" (ปี พ.ศ.) */
export function formatPeriod(period: string, style: "long" | "short" = "long"): string {
  const [y, m] = period.split("-").map(Number);
  const be = y + 543;
  return style === "long" ? `${MONTHS_LONG[m - 1]} ${be}` : `${MONTHS_SHORT[m - 1]} ${String(be).slice(-2)}`;
}

const baht = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatBaht(n: number): string {
  return baht.format(Math.round(n));
}

/** ล้านบาท: 1 ตำแหน่งเมื่อ ≥ 1 ล้าน, ไม่งั้น 2 ตำแหน่ง */
export function formatMillions(n: number): string {
  if (n === 0) return "0";
  const m = n / 1_000_000;
  const digits = Math.abs(m) >= 1 ? 1 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(m);
}

export function formatPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}
