"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPct, formatPeriod } from "@/backend/lib/format";

export type MarginPoint = { period: string; gp: number | null; pbt: number | null };
export type MarginUnit = { code: string; name: string; href: string; points: MarginPoint[] };

const W = 320;
const H = 132;
const PAD = { top: 10, right: 8, bottom: 22, left: 40 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;
/** หน่วยรายได้น้อยมาก % พุ่งเกินร้อย — ตัดสเกลไว้ที่ ±100% ไม่ให้กราฟอื่นแบนจนอ่านไม่ออก (ค่าจริงอยู่ใน tooltip) */
const CLAMP = 100;

const SERIES = [
  { key: "gp", label: "GP Margin", color: "var(--line-gp)" },
  { key: "pbt", label: "PBT Margin", color: "var(--line-pbt)" },
] as const;

/**
 * แนวโน้ม GP% และ PBT% 12 เดือน ของหน่วยปฏิบัติการที่มีรายได้ — กราฟเล็กหน่วยละ 1 ช่อง ใช้สเกลแกน Y เดียวกันทุกช่องจึงเทียบกันได้
 * แถบพื้นหลัง = เดือนที่เลือกดูอยู่ · เส้น 0% เข้ม · จุดขาดทุน (PBT% < 0) เป็นวงแหวนแดง · เดือนที่ไม่มีรายได้ เส้นขาด ไม่ลากต่อ
 */
export function MarginTrends({ units, window, selected }: { units: MarginUnit[]; window: string[]; selected: string[] }) {
  const values = units.flatMap((u) => u.points.flatMap((p) => [p.gp, p.pbt])).filter((v): v is number => v != null);
  let lo = Math.max(-CLAMP, Math.min(0, ...values));
  let hi = Math.min(CLAMP, Math.max(0, ...values));
  if (hi - lo < 10) hi = lo + 10;
  const span = hi - lo;
  lo -= span * 0.06;
  hi += span * 0.08;
  const clipped = values.some((v) => v < -CLAMP || v > CLAMP);
  // เส้นอ้างอิง: 0% เสมอ + ค่าต่ำสุด/สูงสุด (ปัด 5) ถ้าห่างจาก 0 พอที่ป้ายจะไม่ทับกัน
  const ticks = [0, ...[lo, hi].map((v) => Math.trunc(v / 5) * 5).filter((v) => Math.abs(v) >= (hi - lo) * 0.2)];

  const scale = { lo, hi, ticks, window, selected: new Set(selected) };

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="card-title">แนวโน้ม Margin 12 เดือน</h2>
          <p className="card-cap mb-0!">
            หน่วยที่มีรายได้ {units.length} หน่วย · {formatPeriod(window[0], "short")} – {formatPeriod(window[window.length - 1], "short")} · ทุกช่องใช้สเกลเดียวกัน
            {clipped && ` · ค่าที่เกิน ±${CLAMP}% ถูกตัดที่ขอบกราฟ`}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-2" aria-label="คำอธิบายกราฟ">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-[4px] bg-brand-soft" aria-hidden />
            เดือนที่เลือก
          </li>
        </ul>
      </div>
      {units.length === 0 ? (
        <p className="text-sm text-ink-3">ไม่มีหน่วยที่มีรายได้ในงวดนี้</p>
      ) : (
        <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => <UnitTrend key={u.code} unit={u} scale={scale} />)}
        </div>
      )}
    </section>
  );
}

type Scale = { lo: number; hi: number; ticks: number[]; window: string[]; selected: Set<string> };

function UnitTrend({ unit, scale }: { unit: MarginUnit; scale: Scale }) {
  const [hover, setHover] = useState<number | null>(null);
  const { lo, hi, ticks, window, selected } = scale;
  const n = window.length;
  const step = innerW / Math.max(n - 1, 1);
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * innerH;

  // เส้นขาดเมื่อเดือนนั้นไม่มีค่า (ไม่มีรายได้/ไม่มีข้อมูล)
  const pathOf = (key: "gp" | "pbt") =>
    unit.points
      .map((p, i) => {
        const v = p[key];
        if (v == null) return "";
        const prev = i > 0 ? unit.points[i - 1][key] : null;
        return `${prev == null ? "M" : "L"}${x(i)},${y(v)}`;
      })
      .join(" ");

  // ค่าล่าสุดในชุดเดือนที่เลือก
  const latest = [...unit.points].reverse().find((p) => selected.has(p.period) && (p.gp != null || p.pbt != null));
  const selIdx = window.flatMap((p, i) => (selected.has(p) ? [i] : []));
  const active = hover != null ? unit.points[hover] : null;

  return (
    <figure className="relative border-t border-line pt-3 pb-2">
      <figcaption className="mb-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <Link href={unit.href} className="min-w-0 truncate font-semibold hover:text-brand hover:underline hover:underline-offset-3">
          {unit.name}
        </Link>
        {latest && (
          <span className="num shrink-0 text-xs text-ink-2">
            GP <b className={`font-semibold ${latest.gp != null && latest.gp < 0 ? "text-loss-text" : "text-ink"}`}>{formatPct(latest.gp)}</b>
            {" · "}
            PBT <b className={`font-semibold ${latest.pbt != null && latest.pbt < 0 ? "text-loss-text" : "text-ink"}`}>{formatPct(latest.pbt)}</b>
          </span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${unit.name}: GP Margin ${formatPct(latest?.gp ?? null)}, PBT Margin ${formatPct(latest?.pbt ?? null)} ในเดือนล่าสุดที่เลือก`}
        onMouseLeave={() => setHover(null)}
      >
        {selIdx.length > 0 && (
          <rect
            x={x(selIdx[0]) - step / 2}
            y={PAD.top}
            width={(selIdx[selIdx.length - 1] - selIdx[0] + 1) * step}
            height={innerH}
            rx={6}
            fill="var(--brand-soft)"
          />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--line-strong)" : "var(--line)"}
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : "2 4"}
            />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--ink-3)">
              {t}%
            </text>
          </g>
        ))}
        {[0, n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fontSize={10.5} fill="var(--ink-3)">
            {formatPeriod(window[i], "short")}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--line-strong)" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />}
        {SERIES.map((s) => (
          <path key={s.key} className="trend-line" pathLength={1} d={pathOf(s.key)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <g className="trend-dots">
          {unit.points.map((p, i) => {
            // จุดเฉพาะเดือนที่ชี้ เดือนที่ขาดทุน และเดือนเดี่ยวที่ไม่มีเส้นต่อ
            const lonely = (k: "gp" | "pbt") => p[k] != null && (i === 0 || unit.points[i - 1][k] == null) && (i === n - 1 || unit.points[i + 1][k] == null);
            return SERIES.map((s) => {
              const v = p[s.key];
              if (v == null) return null;
              const loss = s.key === "pbt" && v < 0;
              if (hover !== i && !loss && !lonely(s.key)) return null;
              return (
                <circle
                  key={`${s.key}-${p.period}`}
                  cx={x(i)}
                  cy={y(v)}
                  r={hover === i ? 4.5 : 3.25}
                  fill="var(--surface)"
                  stroke={loss ? "var(--loss)" : s.color}
                  strokeWidth={2.25}
                />
              );
            });
          })}
        </g>
        {unit.points.map((p, i) => (
          <rect key={p.period} x={x(i) - step / 2} y={PAD.top} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {active && (
        <div
          role="status"
          className="pop-in pointer-events-none absolute top-9 z-10 rounded-2xl bg-surface px-3 py-1.5 text-xs shadow-(--shadow-pop)"
          style={{ left: `${Math.min(Math.max((x(hover!) / W) * 100 - 12, 0), 62)}%` }}
        >
          <div className="text-ink-2">{formatPeriod(active.period)}</div>
          {active.gp == null && active.pbt == null ? (
            <div className="text-ink-3">ไม่มีรายได้</div>
          ) : (
            <div className="num font-semibold whitespace-nowrap">
              <span style={{ color: "var(--line-gp)" }}>GP</span> <span className={active.gp != null && active.gp < 0 ? "text-loss-text" : "text-ink"}>{formatPct(active.gp)}</span>
              {" · "}
              <span style={{ color: "var(--line-pbt)" }}>PBT</span> <span className={active.pbt != null && active.pbt < 0 ? "text-loss-text" : "text-ink"}>{formatPct(active.pbt)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
