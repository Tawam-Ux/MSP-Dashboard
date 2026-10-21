"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatBahtCompact, formatSignedPct } from "@/backend/lib/format";
import { ExpandCard } from "@/frontend/components/expand-card/expand-card";
import { Money, useMoney } from "@/frontend/components/money";
import { RANK_H, rankGeometry } from "./rank-geometry";
import s from "./branch-rank-chart.module.css";

export type RankMetric = "rev" | "gpm" | "pbtm";
/** สาขาบนเส้น (เรียงค่ามากไปน้อย) */
export type RankRow = { code: string; name: string; value: number; href: string };
/** สาขาที่ไม่อยู่บนเส้น: มียอดขายแต่ไม่มี ตร.ม. — sales = ยอดขาย Group A */
export type MissingRow = { code: string; name: string; sales: number; href: string };

/** สีเส้น = สีของตัวชี้วัด (รายได้ น้ำเงิน · GP เขียว · PBT ม่วง) */
const LINE: Record<RankMetric, string> = { rev: "var(--line-rev)", gpm: "var(--line-gp)", pbtm: "var(--line-pbt)" };
/** สีเกณฑ์ ตรงกับเครื่องหมาย "เกณฑ์" ในการ์ดย่อยที่มาของเกณฑ์ด้านบน */
const BENCH: Record<RankMetric, string> = { rev: "var(--line-pbt)", gpm: "var(--line-op)", pbtm: "var(--line-op)" };
/** ระยะสาขาแคบกว่านี้ (px) ไม่วาดจุดทุกสาขา */
const DOT_STEP = 6;
/** ระยะในขวา/ล่างของการ์ด Nope ที่ขยาย (ตรงกับ .nopePanel) — ยื่นพ้นการ์ดเล็กเท่ากัน การ์ดเล็กจึงอยู่ที่เดิมตลอดการขยาย */
const NOPE_PAD = 12;
const nopeWidth = (_tile: number, view: number) => Math.min(344, view - 24);

/**
 * Branch Ranking แบบกราฟเส้น: แกน X = อันดับ (1 ซ้ายสุด) · แกน Y = ค่าของเกณฑ์วัด เริ่มที่ 0
 * เส้นประ = เกณฑ์ของโซน · ช่วงที่เส้นต่ำกว่าเกณฑ์ระบายสีเตือนอ่อน · ป้ายบนจุดตัดบอกจำนวนผ่าน/ต่ำกว่า
 * ชี้หรือแตะ = ดูสาขา (แตะซ้ำบนจอสัมผัส = เปิด) · คลิก = เปิดงบของสาขา · คีย์บอร์ด: ลูกศรซ้าย/ขวา Home End แล้ว Enter
 * สาขาที่ไม่มี ตร.ม. อยู่ในการ์ด Nope มุมล่างขวา (ชี้แล้วขยายแบบ Microsoft Store)
 */
export function BranchRankChart({ rows, missing, bench, metric, metricLabel, unit }: {
  rows: RankRow[];
  missing: MissingRow[];
  bench: number | null;
  metric: RankMetric;
  metricLabel: string;
  /** หน่วยต่อท้ายค่าใน tooltip (เกณฑ์รายได้ = บาท/ตร.ม.) */
  unit?: string;
}) {
  const router = useRouter();
  const money = useMoney();
  const uid = useId().replace(/[^\w-]/g, "");
  const boxRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef(false);
  const tappedRef = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // วาดตามความกว้างจริงของการ์ด (ย่อขยายจอ → วาดใหม่)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => (width > 0 ? rankGeometry(rows.map((r) => r.value), bench, width) : null), [rows, bench, width]);

  const full = (v: number) => (metric === "rev" ? `${v < 0 ? "−" : ""}${money.fmt(Math.abs(v))}` : formatSignedPct(v));
  const tick = (v: number) => (metric === "rev" ? `${v < 0 ? "−" : ""}${formatBahtCompact(Math.abs(v))}` : `${v < 0 ? "−" : ""}${Math.abs(v)}%`);
  const gap = (d: number) => `${d >= 0 ? "+" : "−"}${metric === "rev" ? money.fmt(Math.abs(d)) : `${Math.abs(d).toFixed(1)} จุด`}`;

  const last = rows.length - 1;
  const pass = bench == null ? null : rows.filter((r) => r.value >= bench).length;
  const nearest = (clientX: number, el: Element) => {
    if (!geo) return 0;
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    geo.points.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(geo.points[best].x - x)) best = i;
    });
    return best;
  };
  const openBranch = (i: number) => router.push(rows[i].href);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const move = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (move) {
      e.preventDefault();
      setActive((a) => (a == null ? 0 : Math.max(0, Math.min(last, a + move))));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if (e.key === "Enter" && active != null) {
      e.preventDefault();
      openBranch(active);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const p = geo && active != null ? geo.points[active] : null;
  const row = active != null ? rows[active] : null;
  const diff = row && bench != null ? row.value - bench : null;
  const lossLine = geo != null && rows.some((r) => r.value < 0);

  const summary =
    rows.length === 0
      ? ""
      : `อันดับ 1 ${rows[0].name} ${full(rows[0].value)} · อันดับสุดท้าย ${rows[last].name} ${full(rows[last].value)}` +
        (bench != null && pass != null ? ` · เกณฑ์ ${full(bench)} · ผ่าน ${pass} สาขา ต่ำกว่า ${rows.length - pass} สาขา` : "");

  return (
    <div className={s.root} style={{ "--rank-line": LINE[metric], "--rank-bench": BENCH[metric] } as React.CSSProperties}>
      {rows.length === 0 ? (
        <p className={s.empty}>{metric === "rev" ? "ยังไม่มีสาขาที่มีข้อมูล ตร.ม. ในงวดนี้" : "ไม่มีสาขาที่มีรายได้ในงวดนี้"}</p>
      ) : (
        <>
          <div
            ref={boxRef}
            className={s.chart}
            style={{ height: RANK_H }}
            tabIndex={0}
            role="group"
            aria-label={`อันดับสาขาตาม ${metricLabel} ${rows.length} สาขา — ลูกศรซ้าย/ขวาเลือกสาขา Enter เปิดงบ`}
            aria-describedby={`${uid}-sum`}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            {geo && (
              <>
                <svg className={s.svg} width={width} height={RANK_H} aria-hidden>
                  <defs>
                    {geo.benchY != null && (
                      <clipPath id={`${uid}-under`}>
                        <rect x={0} y={geo.benchY} width={width} height={RANK_H - geo.benchY} />
                      </clipPath>
                    )}
                    {lossLine && (
                      <>
                        <clipPath id={`${uid}-pos`}>
                          <rect x={0} y={0} width={width} height={geo.zeroY} />
                        </clipPath>
                        <clipPath id={`${uid}-neg`}>
                          <rect x={0} y={geo.zeroY} width={width} height={RANK_H - geo.zeroY} />
                        </clipPath>
                      </>
                    )}
                  </defs>
                  {geo.ticks.map((t) => (
                    <g key={t.value}>
                      <line className={t.value === 0 && geo.ticks[0].value < 0 ? s.zero : s.grid} x1={geo.plot.left} x2={geo.plot.right} y1={t.y} y2={t.y} />
                      <text className={s.tick} x={geo.plot.left - 8} y={t.y} dy="0.35em" textAnchor="end">{tick(t.value)}</text>
                    </g>
                  ))}
                  {geo.benchY != null && geo.shortfall && <path className={s.short} d={geo.shortfall} clipPath={`url(#${uid}-under)`} />}
                  {geo.benchY != null && <line className={s.bench} x1={geo.plot.left} x2={geo.plot.right} y1={geo.benchY} y2={geo.benchY} />}
                  {geo.crossX != null && <line className={s.cross} x1={geo.crossX} x2={geo.crossX} y1={geo.plot.top - 6} y2={geo.plot.bottom} />}
                  {lossLine ? (
                    <>
                      <path className={`trend-line ${s.line}`} pathLength={1} d={geo.line} clipPath={`url(#${uid}-pos)`} />
                      <path className={`trend-line ${s.line}`} data-loss pathLength={1} d={geo.line} clipPath={`url(#${uid}-neg)`} />
                    </>
                  ) : (
                    <path className={`trend-line ${s.line}`} pathLength={1} d={geo.line} />
                  )}
                  {geo.step >= DOT_STEP && (
                    <g className="trend-dots">
                      {geo.points.map((pt, i) => (
                        <circle key={rows[i].code} className={s.dot} data-loss={pt.value < 0 || undefined} cx={pt.x} cy={pt.y} r={2.75} />
                      ))}
                    </g>
                  )}
                  {p && (
                    <g>
                      <line className={s.guide} x1={p.x} x2={p.x} y1={geo.plot.top - 6} y2={geo.plot.bottom} />
                      <circle className={s.halo} data-loss={p.value < 0 || undefined} cx={p.x} cy={p.y} r={10} />
                      <circle className={s.station} data-loss={p.value < 0 || undefined} cx={p.x} cy={p.y} r={5} />
                    </g>
                  )}
                  <rect
                    className={s.hit}
                    width={width}
                    height={RANK_H}
                    onPointerDown={(e) => {
                      touchRef.current = e.pointerType === "touch";
                      tappedRef.current = active;
                      if (touchRef.current) setActive(nearest(e.clientX, e.currentTarget));
                    }}
                    onPointerMove={(e) => {
                      if (e.pointerType !== "touch") setActive(nearest(e.clientX, e.currentTarget));
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType !== "touch") setActive(null);
                    }}
                    onClick={(e) => {
                      const i = nearest(e.clientX, e.currentTarget);
                      // จอสัมผัส: แตะแรก = ดูสาขา · แตะซ้ำสาขาเดิม = เปิดงบ
                      if (touchRef.current && tappedRef.current !== i) return;
                      openBranch(i);
                    }}
                  />
                </svg>

                {geo.benchY != null && bench != null && (
                  <span className={s.benchLabel} style={{ top: geo.benchY - 3 }}>
                    <i className={s.benchKey} aria-hidden />
                    เกณฑ์ <b className="num font-semibold text-ink">{full(bench)}</b>
                  </span>
                )}
                {pass != null && (
                  <span
                    className={s.split}
                    style={{ left: Math.min(Math.max(geo.crossX ?? (pass === 0 ? geo.plot.right : geo.plot.left), geo.plot.left + 64), width - 64), translate: "-50% 0" }}
                  >
                    {pass > 0 && <span>ผ่าน {pass}</span>}
                    {pass < rows.length && <span>ต่ำกว่า {rows.length - pass}</span>}
                  </span>
                )}
                {p && row && (
                  <div
                    role="status"
                    className={s.tip}
                    style={{
                      left: Math.min(Math.max(p.x, 96), width - 96),
                      top: p.y > 96 ? p.y - 14 : p.y + 14,
                      translate: p.y > 96 ? "-50% -100%" : "-50% 0",
                    }}
                  >
                    <div className={s.tipName}>
                      <span className={`${s.tipRank} num`}>#{active! + 1}</span>
                      {row.name}
                    </div>
                    <div className={s.tipValue}>
                      <b className="num">{full(row.value)}</b>
                      {unit && <span> {unit}</span>}
                    </div>
                    {diff != null && (
                      <div className={s.tipDiff}>
                        <i className={s.tipDot} data-pass={diff >= 0 || undefined} aria-hidden />
                        {diff >= 0 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์"} <span className="num">{gap(diff)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className={s.ranks} aria-hidden>
            {geo?.ranks.map((r) => (
              <span key={r.rank} style={{ left: r.x }}>
                {r.rank === 1 ? "อันดับ 1" : r.rank}
              </span>
            ))}
          </div>
          <p id={`${uid}-sum`} className="sr-only">{summary}</p>
        </>
      )}

      <div className={s.foot}>
        {rows.length > 0 && <span className={s.footHint}>ชี้ที่เส้นเพื่อดูสาขา · คลิกเพื่อเปิดงบ</span>}
        {missing.length > 0 && <Nope rows={missing} />}
      </div>
    </div>
  );
}

/** การ์ดเล็ก Nope: สถานีสีเทา (ยังไม่อยู่บนเส้น) + จำนวนสาขา — mirror = ตัวที่อยู่ในการ์ดที่ขยาย (ทับการ์ดเดิมพอดี) */
function NopeChip({ count, mirror = false }: { count: number; mirror?: boolean }) {
  return (
    <span className={s.chip} aria-hidden={mirror || undefined}>
      <i className={s.offDot} aria-hidden />
      <span className={s.chipWord}>Nope</span>
      <span className="num">{count} สาขา</span>
    </span>
  );
}

/** สาขาที่ไม่มี ตร.ม.: การ์ดเล็กมุมล่างขวา ชี้แล้วขยายขึ้นไปทางซ้ายบน แสดงรายชื่อ (คลิกเปิดงบของสาขา) */
function Nope({ rows }: { rows: MissingRow[] }) {
  return (
    <ExpandCard
      label={`Nope: สาขาที่ยังไม่มีพื้นที่ ตร.ม. ${rows.length} สาขา`}
      width={nopeWidth}
      place={{ x: "end", y: "up" }}
      anchor={{ x: "end", y: "end" }}
      lift={NOPE_PAD}
      inset={NOPE_PAD}
      className={s.nope}
      panelClassName={s.nopePanel}
      panel={
        <>
          <div>
            <p className={s.nopeTitle}>ยังไม่มีพื้นที่ ตร.ม. · {rows.length} สาขา</p>
            <p className={s.nopeCap}>คิดรายได้ต่อ ตร.ม. ไม่ได้ จึงไม่อยู่บนเส้นอันดับ · เรียงตามยอดขาย (Group A)</p>
          </div>
          <ul className={s.nopeList}>
            {rows.map((r, i) => (
              <li key={r.code} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                <Link href={r.href} className={s.nopeRow}>
                  <i className={s.offDot} aria-hidden />
                  <span className={s.nopeName}>{r.name}</span>
                  <span className="num text-ink-2"><Money value={r.sales} /></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={s.nopeChev}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
          <div className={s.nopeFoot}>
            <span className={s.nopeCap}>เพิ่ม ตร.ม. ได้ที่ Branch Area</span>
            <NopeChip count={rows.length} mirror />
          </div>
        </>
      }
    >
      <NopeChip count={rows.length} />
    </ExpandCard>
  );
}
