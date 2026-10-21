// เรขาคณิตของกราฟ Branch Ranking (เส้นอันดับสาขา เรียงจากค่ามากไปน้อย) — ฟังก์ชันล้วน ไม่แตะ DOM

/** ความสูงกราฟ (ไม่รวมแถวเลขอันดับ) */
export const RANK_H = 232;
/** ที่ว่างรอบพื้นที่กราฟ: ซ้าย = เลขแกน Y · บน = ป้ายผ่าน/ต่ำกว่า */
const PAD = { top: 30, right: 12, bottom: 8, left: 44 };

const round = (n: number) => Math.round(n * 10) / 10;

export type RankPoint = { x: number; y: number; value: number };

export type RankGeometry = {
  points: RankPoint[];
  line: string;
  /** พื้นระหว่างเส้นกับเกณฑ์ — ตัดเหลือเฉพาะใต้เส้นเกณฑ์ = ช่วงที่ต่ำกว่าเกณฑ์ */
  shortfall: string;
  benchY: number | null;
  zeroY: number;
  ticks: { value: number; y: number }[];
  /** จำนวนสาขาที่ผ่านเกณฑ์ (null = ไม่มีเกณฑ์) */
  pass: number | null;
  /** x ที่เส้นตัดเกณฑ์ (เฉพาะเมื่อมีทั้งผ่านและต่ำกว่า) */
  crossX: number | null;
  /** เลขอันดับใต้กราฟ */
  ranks: { rank: number; x: number }[];
  plot: { left: number; right: number; top: number; bottom: number };
  /** ระยะระหว่างสาขา (px) */
  step: number;
};

/** เลขแกนลงตัว (1, 2, 2.5, 5 × 10ⁿ) ครอบช่วง lo–hi ราว count ช่อง */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= count) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.max(Math.ceil(hi / step) * step, start + step);
  const ticks: number[] = [];
  for (let k = 0; start + k * step <= end + step / 2; k++) ticks.push(Number((start + k * step).toPrecision(12)));
  return ticks;
}

/** เลขอันดับใต้กราฟ: 1 · ทุก 5/10/20 อันดับ · อันดับสุดท้าย — ห่างกันอย่างน้อย 28px (อันดับสุดท้ายแทนตัวก่อนหน้าที่ชิดเกิน) */
function rankLabels(n: number, x: (i: number) => number): { rank: number; x: number }[] {
  if (n === 0) return [];
  const every = n <= 15 ? 5 : n <= 60 ? 10 : 20;
  const wanted = [...new Set([1, ...Array.from({ length: Math.floor(n / every) }, (_, k) => (k + 1) * every), n])];
  const out: { rank: number; x: number }[] = [];
  for (const rank of wanted) {
    const at = x(rank - 1);
    const prev = out[out.length - 1];
    if (prev && at - prev.x < 28) {
      if (rank === n) out[out.length - 1] = { rank, x: at };
      continue;
    }
    out.push({ rank, x: at });
  }
  return out;
}

/**
 * กราฟอันดับขนาด width × height px: values เรียงมากไปน้อย (อันดับ 1 ซ้ายสุด)
 * แกน Y เริ่มที่ 0 (ขนาดเทียบกันได้ตรงๆ แบบแถบเดิม) และครอบเกณฑ์เสมอ
 */
export function rankGeometry(values: number[], bench: number | null, width: number, height = RANK_H): RankGeometry {
  const ref = bench ?? 0;
  const tickValues = niceTicks(Math.min(0, ref, ...values), Math.max(0, ref, ...values));
  const lo = tickValues[0];
  const hi = tickValues[tickValues.length - 1];
  const plot = { left: PAD.left, right: width - PAD.right, top: PAD.top, bottom: height - PAD.bottom };
  const y = (v: number) => plot.top + ((hi - v) / (hi - lo)) * (plot.bottom - plot.top);
  const n = values.length;
  const step = n > 1 ? (plot.right - plot.left) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? plot.left + i * step : (plot.left + plot.right) / 2);
  const points = values.map((value, i) => ({ x: x(i), y: y(value), value }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${round(p.x)},${round(p.y)}`).join("");
  const benchY = bench == null ? null : y(bench);
  const shortfall =
    benchY == null || n < 2
      ? ""
      : `M${round(points[0].x)},${round(benchY)}${points.map((p) => `L${round(p.x)},${round(p.y)}`).join("")}L${round(points[n - 1].x)},${round(benchY)}Z`;

  // เรียงมากไปน้อย: สาขาแรกที่ต่ำกว่าเกณฑ์ = จำนวนที่ผ่าน · เส้นตัดเกณฑ์ระหว่างสาขานั้นกับสาขาก่อนหน้า
  let pass: number | null = null;
  let crossX: number | null = null;
  if (bench != null) {
    const k = values.findIndex((v) => v < bench);
    pass = k === -1 ? n : k;
    if (k > 0) {
      const a = points[k - 1];
      const b = points[k];
      crossX = a.x + ((a.value - bench) / (a.value - b.value)) * (b.x - a.x);
    }
  }

  return {
    points,
    line,
    shortfall,
    benchY,
    zeroY: y(0),
    ticks: tickValues.map((value) => ({ value, y: y(value) })),
    pass,
    crossX,
    ranks: rankLabels(n, x),
    plot,
    step,
  };
}
