"use client";

import { useState } from "react";
import { formatPeriod } from "@/backend/lib/format";
import { useMoney } from "./money";

export type TrendPoint = { period: string; value: number | null };

const W = 640;
const H = 220;
const BASE_PAD = { top: 16, right: 16, bottom: 28, left: 52 };

/** กราฟเส้นเดียว + crosshair/tooltip — kind: "money" = เงินตามรูปแบบที่เลือก, "pct" = % */
export function TrendChart({ points, kind, label, color = "var(--line-rev)" }: { points: TrendPoint[]; kind: "money" | "pct"; label: string; color?: string }) {
  const money = useMoney();
  const format = (n: number) => (kind === "money" ? money.fmt(n) : `${n.toFixed(1)}%`);
  const unitLabel = kind === "money" ? money.unitLong : "";
  // แกนตัวเลขเต็ม (บาท) ยาวกว่า ต้องเว้นซ้ายมากขึ้น
  const PAD = { ...BASE_PAD, left: kind === "money" && money.mode === "full" ? 92 : BASE_PAD.left };
  const [hover, setHover] = useState<number | null>(null);
  const values = points.flatMap((p) => (p.value == null ? [] : [p.value]));
  if (values.length === 0) return <p className="text-sm text-ink-3">ไม่มีข้อมูล</p>;

  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = min + 1;
  const span = max - min;
  min -= span * 0.05;
  max += span * 0.08;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * innerH;
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);

  const path = points
    .map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(" L");
  const active = hover != null ? points[hover] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`แนวโน้ม ${label}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {min < 0 && <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} />}
        {points.map((p, i) => (
          <text key={p.period} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
            {formatPeriod(p.period, "short")}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line-strong)" strokeWidth={2} strokeLinecap="round" strokeDasharray="1 5" />}
        {/* เส้นสายหนา + จุดสถานีวงแหวนทุกงวด — งวดที่ติดลบเป็นวงแหวนแดง */}
        {path && (
          <path
            key={`line-${path}`}
            className="trend-line"
            pathLength={1}
            d={`M${path}`}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <g key={`dots-${path}`} className="trend-dots">
        {points.map((p, i) =>
          p.value == null ? null : (
            <circle
              key={p.period}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 7 : 5.5}
              fill="var(--surface)"
              stroke={p.value < 0 ? "var(--loss)" : color}
              strokeWidth={hover === i ? 4.5 : 3.5}
            />
          ),
        )}
        </g>
        {/* พื้นที่รับเมาส์กว้างกว่าจุด */}
        {points.map((p, i) => (
          <rect
            key={p.period}
            x={x(i) - innerW / Math.max(points.length, 2) / 2}
            y={PAD.top}
            width={innerW / Math.max(points.length, 2)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {active && active.value != null && (
        <div
          role="status"
          className="pop-in pointer-events-none absolute top-0 rounded-2xl bg-surface px-3 py-1.5 text-xs shadow-(--shadow-pop)"
          style={{ left: `${Math.min(Math.max((x(hover!) / W) * 100, 8), 78)}%` }}
        >
          <div className="text-ink-2">{formatPeriod(active.period)}</div>
          <div className="num font-semibold text-ink">{format(active.value)} {unitLabel}</div>
        </div>
      )}
    </figure>
  );
}
