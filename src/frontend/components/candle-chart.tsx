"use client";

import { useState } from "react";
import { formatPeriod } from "@/backend/lib/format";
import { useMoney } from "./money";

/**
 * แท่งเทียนรายเดือน 1 แท่ง = 1 เดือน
 * เปิด = ค่าเดือนก่อน · ปิด = ค่าเดือนนี้ · ไส้บน/ล่าง = สาขาที่ดีสุด/แย่สุดในเดือนนั้น
 * แท่งดำ = ดีขึ้นจากเดือนก่อน · แท่งแดง = แย่ลง (มี ▲/▼ ในกล่องข้อมูลด้วย ไม่พึ่งสีอย่างเดียว)
 */
export type Candle = {
  period: string;
  /** null = เดือนแรกที่มีข้อมูล (ไม่มีเดือนก่อนให้เทียบ) */
  open: number | null;
  close: number;
  high: number;
  low: number;
  highName: string;
  lowName: string;
};

export type CandleMetric = { key: string; label: string; kind: "money" | "pct"; note: string; candles: Candle[] };

const W = 720;
const H = 260;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;

/** ขอบเขตแกน: ครอบตัวแท่งทุกแท่ง แล้วให้ไส้ยื่นออกได้ไม่เกิน 1.5 เท่าของช่วงตัวแท่ง — สาขาที่ค่าสุดโต่ง (เช่น margin -4000%) ไม่บีบกราฟจนแบน */
function domainOf(candles: Candle[]): [number, number] {
  const bodies = candles.flatMap((c) => [c.close, c.open ?? c.close]);
  let lo = Math.min(...bodies);
  let hi = Math.max(...bodies);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-6);
  lo = Math.max(Math.min(lo, ...candles.map((c) => c.low)), lo - span * 1.5);
  hi = Math.min(Math.max(hi, ...candles.map((c) => c.high)), hi + span * 1.5);
  const pad = (hi - lo) * 0.06;
  return [lo - pad, hi + pad];
}

export function CandleChart({ metrics }: { metrics: CandleMetric[] }) {
  const money = useMoney();
  const [metricKey, setMetricKey] = useState(metrics[0]?.key);
  const [hover, setHover] = useState<number | null>(null);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  if (!metric || metric.candles.length === 0) return <p className="text-sm text-ink-3">ไม่มีข้อมูล</p>;

  const format = (n: number) => (metric.kind === "money" ? money.fmt(n) : `${n.toFixed(1)}%`);
  const unit = metric.kind === "money" ? money.unitLong : "";
  const padLeft = metric.kind === "money" && money.mode === "full" ? 96 : 60;
  const candles = metric.candles;
  const [min, max] = domainOf(candles);
  const innerW = W - padLeft - 16;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const slot = innerW / candles.length;
  const bodyW = Math.min(36, slot * 0.5);
  const x = (i: number) => padLeft + slot * (i + 0.5);
  const y = (v: number) => PAD_TOP + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const active = hover != null ? candles[hover] : null;

  return (
    <div>
      {/* ตัวเลือกตัวชี้วัดของการ์ดนี้เอง (แยกจากตัวกรองของหน้า) */}
      <div role="tablist" aria-label="ตัวชี้วัดของกราฟแท่งเทียน" className="seg mb-3 inline-flex">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={m.key === metric.key}
            aria-current={m.key === metric.key ? "true" : undefined}
            onClick={() => { setMetricKey(m.key); setHover(null); }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-ink-3">{metric.note}</p>

      <figure className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`แท่งเทียนรายเดือน ${metric.label}`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padLeft} x2={W - 16} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
              <text x={padLeft - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">{format(t)}</text>
            </g>
          ))}
          {min < 0 && max > 0 && <line x1={padLeft} x2={W - 16} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} />}
          {hover != null && <rect x={x(hover) - slot / 2 + 2} y={PAD_TOP} width={slot - 4} height={innerH} rx={10} fill="var(--surface-2)" />}

          {candles.map((c, i) => {
            const open = c.open ?? c.close;
            const up = c.close >= open;
            const color = up ? "var(--ink)" : "var(--loss)";
            const top = y(Math.max(open, c.close));
            const bottom = y(Math.min(open, c.close));
            // ไส้ที่เกินขอบแกน: ปลายเป็นลูกศรบอกว่ายังมีค่าเลยออกไป (ดูค่าจริงในกล่องข้อมูล)
            const highClipped = c.high > max;
            const lowClipped = c.low < min;
            return (
              <g key={c.period}>
                <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={2} strokeLinecap="round" />
                {highClipped && <path d={`M${x(i) - 4} ${y(max) + 5} L${x(i)} ${y(max)} L${x(i) + 4} ${y(max) + 5}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {lowClipped && <path d={`M${x(i) - 4} ${y(min) - 5} L${x(i)} ${y(min)} L${x(i) + 4} ${y(min) - 5}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                <rect
                  x={x(i) - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={Math.max(2, bottom - top)}
                  rx={3}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  paintOrder="stroke"
                />
                <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={11} fill={hover === i ? "var(--ink)" : "var(--ink-3)"} fontWeight={hover === i ? 600 : 400}>
                  {formatPeriod(c.period, "short")}
                </text>
                {/* พื้นที่รับเมาส์ทั้งช่องของเดือน */}
                <rect x={x(i) - slot / 2} y={PAD_TOP} width={slot} height={innerH + PAD_BOTTOM} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            role="status"
            className="pop-in pointer-events-none absolute top-1 z-10 w-60 rounded-2xl bg-surface px-3.5 py-2.5 text-xs shadow-(--shadow-pop)"
            style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% + ${x(hover!) / W > 0.6 ? "-15.5rem" : "1rem"}), calc(100% - 15rem))` }}
          >
            {(() => {
              const diff = active.open == null ? null : active.close - active.open;
              const up = diff == null || diff >= 0;
              return (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{formatPeriod(active.period)}</span>
                    {diff != null && (
                      <span className={`num font-semibold ${up ? "text-ink" : "text-loss-text"}`}>
                        {up ? "▲" : "▼"} {format(Math.abs(diff))}{metric.kind === "pct" ? " จุด" : ""}
                      </span>
                    )}
                  </div>
                  <dl className="num mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink-2">
                    <dt>เปิด (เดือนก่อน)</dt><dd className="text-right">{active.open == null ? "—" : format(active.open)}</dd>
                    <dt>ปิด (เดือนนี้)</dt><dd className="text-right font-semibold text-ink">{format(active.close)}</dd>
                    <dt>สูงสุด</dt><dd className="truncate text-right">{format(active.high)} · {active.highName}</dd>
                    <dt>ต่ำสุด</dt><dd className="truncate text-right">{format(active.low)} · {active.lowName}</dd>
                  </dl>
                  {unit && <div className="mt-1 text-[0.6875rem] text-ink-3">หน่วย: {unit}</div>}
                </>
              );
            })()}
          </div>
        )}
      </figure>
    </div>
  );
}
