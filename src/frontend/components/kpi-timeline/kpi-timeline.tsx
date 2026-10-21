"use client";

import { useId, useMemo, useState } from "react";
import { changePct, ratioOf } from "@/backend/lib/analysis";
import { MONTHS_SHORT, formatBahtCompact, formatPeriod, formatPeriodRange, formatSignedPct } from "@/backend/lib/format";
import { Delta, Roundel, type LineKey } from "../dash";
import { ExpandCard } from "../expand-card/expand-card";
import { panelWidth } from "../expand-card/geometry";
import { Money, MoneyUnit, SignedMoney, useMoney } from "../money";
import { CHART_H, SWEEP_DELAY_MS, SWEEP_EASE, SWEEP_MS, bezierTimeAt, chartGeometry, cssBezier, monthTicks, previousPoint, type Station } from "./chart";
import type { TimelinePoint, TimelineTone } from "./series";
import s from "./kpi-timeline.module.css";

/** ระยะในซ้าย/ขวาของการ์ดที่ขยาย (ตรงกับ .content) */
const PAD_X = 20;
/** เดือนถี่กว่านี้ (px ต่อเดือน) แสดงสถานีเฉพาะจุดสำคัญ */
const DENSE_STEP = 13;

const COLORS: Record<LineKey, string> = {
  rev: "var(--line-rev)",
  gp: "var(--line-gp)",
  op: "var(--line-op)",
  pbt: "var(--line-pbt)",
  msp: "var(--line-msp)",
  ink: "var(--pill)",
};

const compact = (n: number) => `${n < 0 ? "−" : ""}${formatBahtCompact(Math.abs(n))}`;

/**
 * การ์ด KPI ที่มี Timeline: ชี้ค้าง (หรือโฟกัสด้วยคีย์บอร์ด / แตะบนจอสัมผัส) → การ์ดขยาย (ExpandCard) พร้อมกราฟเส้นรายเดือน
 * กราฟวาดเป็นสายรถไฟของตัวชี้วัด: เดือน = สถานี · เดือนล่าสุด = สถานีปัจจุบัน · เดือนขาดทุน = สถานีแดง และเส้นใต้ 0 เป็นแดง
 * ชี้บนกราฟ (หรือลูกศรซ้าย/ขวา) ดูค่าของแต่ละเดือนในแถบด้านล่าง · ผู้ใช้โปรแกรมอ่านหน้าจอได้ค่าทุกเดือนจากคำอธิบายของการ์ด
 */
export function KpiTimeline({ points, tone, label, value, line, code, children }: {
  points: TimelinePoint[];
  tone: TimelineTone;
  label: string;
  value: number;
  line: LineKey;
  code: string;
  /** การ์ด KPI เดิม */
  children: React.ReactNode;
}) {
  const uid = useId().replace(/[^\w-]/g, "");
  const money = useMoney();
  const [chartW, setChartW] = useState(320);
  const [scrub, setScrub] = useState<number | null>(null);

  const geo = useMemo(() => chartGeometry(points, chartW), [points, chartW]);
  const ticks = useMemo(() => monthTicks(points, geo.xs, geo.step), [points, geo]);
  const latest = geo.stations[geo.stations.length - 1];
  const focusAt = geo.stations.find((st) => st.index === scrub) ?? latest;
  const focus = points[focusAt.index];
  const prev = previousPoint(points, focusAt.index);
  const isLatest = focusAt === latest;
  const loss = focusAt.value < 0;
  const avg = geo.stations.reduce((t, st) => t + st.value, 0) / geo.stations.length;

  // จังหวะที่เส้นกวาดไปถึงตำแหน่ง x (ตรงกับ --kt-sweep-*)
  const arriveAt = (x: number) => `${Math.round(SWEEP_DELAY_MS + bezierTimeAt(x / chartW, SWEEP_EASE) * SWEEP_MS)}ms`;
  const delay = (x: number, extra = 0) => ({ "--d": `calc(${arriveAt(x)} + ${extra}ms)` }) as React.CSSProperties;

  // เดือนถี่: แสดงสถานีเฉพาะหัวท้าย ค่าสูงสุด/ต่ำสุด เดือนขาดทุน และเดือนที่ชี้
  const dense = geo.step < DENSE_STEP;
  const shown = dense
    ? geo.stations.filter((st, i) => i === 0 || st === latest || st === geo.max || st === geo.min || st.value < 0 || st === focusAt)
    : geo.stations;
  const hasLoss = geo.zeroY != null && geo.stations.some((st) => st.value < 0);

  const scrubAt = (e: React.PointerEvent<SVGRectElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = geo.stations[0];
    for (const st of geo.stations) if (Math.abs(st.x - x) < Math.abs(best.x - x)) best = st;
    setScrub(best.index);
  };

  // ลูกศรซ้าย/ขวาระหว่างเปิด: เลือกเดือน
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;
    const i = geo.stations.indexOf(focusAt) + (e.key === "ArrowRight" ? 1 : -1);
    setScrub(geo.stations[Math.max(0, Math.min(geo.stations.length - 1, i))].index);
    return true;
  };

  const peak = (st: Station, above: boolean) => {
    const anchor = st.x < 28 ? "start" : st.x > chartW - 28 ? "end" : "middle";
    const x = anchor === "start" ? st.x - 6 : anchor === "end" ? st.x + 6 : st.x;
    return (
      <text className={s.peak} x={x} y={above ? st.y - 11 : st.y + 19} textAnchor={anchor} style={delay(st.x, 60)}>
        {compact(st.value)}
      </text>
    );
  };

  // ข้างค่าในแถบล่าง: กำไร = % ของรายได้ · รายได้/ต้นทุน = เทียบเดือนก่อน
  const aside =
    tone === "profit" ? (
      focus.revenue ? <span className="num">{formatSignedPct(ratioOf(focusAt.value, focus.revenue))} ของรายได้</span> : "ไม่มีรายได้"
    ) : prev?.value != null ? (
      <Delta value={changePct(focusAt.value, prev.value)} goodWhenUp={tone === "revenue"} label={`จาก ${MONTHS_SHORT[Number(prev.period.slice(5, 7)) - 1]}`} />
    ) : (
      "เดือนแรกของช่วง"
    );

  const description = `Timeline รายเดือน ${label}: ${points
    .map((p) => `${formatPeriod(p.period)} ${p.value == null ? "ไม่มีข้อมูล" : `${p.value < 0 ? "ลบ " : ""}${money.fmt(Math.abs(p.value))} บาท`}`)
    .join(", ")}`;

  const panel = (
    <>
      {/* หัวการ์ดแบบเดียวกับการ์ดเดิม (ตอนเริ่มขยายทับตำแหน่งเดิมพอดี) + ช่วงเดือนทางขวา */}
      <div className="kpi-head">
        <Roundel line={line} code={code} small />
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink-2">{label}</div>
        <span className="num shrink-0 text-xs text-ink-3">{formatPeriodRange(points.map((p) => p.period))}</span>
      </div>
      <div className="kpi-body">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className={`num min-w-0 truncate text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] ${value < 0 ? "text-loss-text" : "text-ink"}`}>
            <Money value={value} />
          </span>
          <span className="shrink-0 text-[0.8125rem] text-ink-3"><MoneyUnit long /></span>
        </div>
        <div className="kpi-note num mt-0.5 text-[0.8125rem] leading-snug text-ink-3">
          เฉลี่ยเดือนละ <SignedMoney value={avg} /> บาท · {geo.stations.length} เดือน
        </div>
      </div>

      <div>
        <div className={s.chart} style={{ height: CHART_H }}>
          <svg className={s.layer} width={chartW} height={CHART_H}>
            {geo.zeroY != null ? (
              <line className={s.zero} x1={0} x2={chartW} y1={geo.zeroY} y2={geo.zeroY} />
            ) : (
              <line className={s.base} x1={0} x2={chartW} y1={geo.bottom} y2={geo.bottom} />
            )}
          </svg>

          <div className={s.sweep}>
            <svg width={chartW} height={CHART_H}>
              <defs>
                <linearGradient id={`${uid}-wash`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={geo.top} y2={geo.baseY}>
                  <stop offset="0" style={{ stopColor: "var(--kt-line)", stopOpacity: 0.2 }} />
                  <stop offset="1" style={{ stopColor: "var(--kt-line)", stopOpacity: 0.02 }} />
                </linearGradient>
                {hasLoss && (
                  <>
                    <linearGradient id={`${uid}-loss`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={geo.baseY} y2={geo.bottom}>
                      <stop offset="0" style={{ stopColor: "var(--loss)", stopOpacity: 0.03 }} />
                      <stop offset="1" style={{ stopColor: "var(--loss)", stopOpacity: 0.18 }} />
                    </linearGradient>
                    <clipPath id={`${uid}-above`}>
                      <rect x={0} y={0} width={chartW} height={geo.baseY} />
                    </clipPath>
                    <clipPath id={`${uid}-below`}>
                      <rect x={0} y={geo.baseY} width={chartW} height={CHART_H - geo.baseY} />
                    </clipPath>
                  </>
                )}
              </defs>
              {hasLoss ? (
                <>
                  {/* ช่วงที่ต่ำกว่า 0 = ขาดทุน: พื้นและเส้นเป็นแดง */}
                  <path d={geo.area} fill={`url(#${uid}-wash)`} clipPath={`url(#${uid}-above)`} />
                  <path d={geo.area} fill={`url(#${uid}-loss)`} clipPath={`url(#${uid}-below)`} />
                  <path className={s.line} d={geo.line} clipPath={`url(#${uid}-above)`} />
                  <path className={s.line} data-loss d={geo.line} clipPath={`url(#${uid}-below)`} />
                </>
              ) : (
                <>
                  <path d={geo.area} fill={`url(#${uid}-wash)`} />
                  <path className={s.line} d={geo.line} />
                </>
              )}
            </svg>
          </div>

          <svg className={s.layer} width={chartW} height={CHART_H}>
            <g className={s.cross} data-on={scrub != null || undefined} style={{ transform: `translateX(${focusAt.x}px)` }}>
              <line x1={0} x2={0} y1={geo.top - 10} y2={geo.bottom + 6} />
            </g>
            <g className={s.haloAt} style={{ transform: `translate(${focusAt.x}px, ${focusAt.y}px)` }}>
              <circle className={s.halo} data-loss={loss || undefined} r={10} style={delay(latest.x, 80)} />
            </g>
            {shown.map((st) => (
              <circle
                key={st.index}
                className={s.station}
                data-on={st === focusAt || undefined}
                data-loss={st.value < 0 || undefined}
                cx={st.x}
                cy={st.y}
                r={4}
                style={delay(st.x)}
              />
            ))}
            {geo.max && peak(geo.max, true)}
            {geo.min && peak(geo.min, false)}
            <rect className={s.hit} width={chartW} height={CHART_H} onPointerMove={scrubAt} onPointerDown={scrubAt} onPointerLeave={() => setScrub(null)} />
          </svg>
        </div>
        <div className={s.months}>
          {ticks.map((t) => (
            <span key={t.index} data-on={t.index === focusAt.index || undefined} style={{ left: geo.xs[t.index], ...delay(geo.xs[t.index]) }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className={s.readout}>
        <span className={s.readMonth}>
          <i className={s.readDot} data-loss={loss || undefined} />
          {formatPeriod(focus.period)}
          {isLatest && <span className="font-normal text-ink-3">· ล่าสุด</span>}
        </span>
        <span className={`${s.readValue} num ${loss ? "text-loss-text" : "text-ink"}`}>
          <SignedMoney value={focusAt.value} unit="short" />
        </span>
        <span className={s.readNote}>
          {loss && tone === "profit" ? <span className="badge badge-bad">ขาดทุน</span> : scrub == null ? "ชี้หรือแตะกราฟเพื่อดูเดือนอื่น" : null}
        </span>
        <span className={s.readAside}>{aside}</span>
      </div>
    </>
  );

  return (
    <ExpandCard
      label={label}
      description={description}
      width={panelWidth}
      decorative
      className={s.tile}
      panelClassName={s.content}
      panelStyle={{
        "--kt-line": COLORS[line],
        "--kt-sweep-ease": cssBezier(SWEEP_EASE),
        "--kt-sweep-ms": `${SWEEP_MS}ms`,
        "--kt-sweep-delay": `${SWEEP_DELAY_MS}ms`,
      } as React.CSSProperties}
      onMeasure={(w) => setChartW(w - PAD_X * 2)}
      onOpenChange={(open) => {
        if (!open) setScrub(null);
      }}
      onPanelKey={onPanelKey}
      panel={panel}
    >
      {children}
      <svg className={s.hint} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 17l5.5-6 4 3.5L21 6" />
        <circle cx="8.5" cy="11" r="2" style={{ fill: "var(--surface)" }} />
        <circle cx="12.5" cy="14.5" r="2" style={{ fill: "var(--surface)" }} />
      </svg>
    </ExpandCard>
  );
}
