// ชิ้นส่วนการ์ดที่ใช้ร่วมกันทุกหน้า dashboard — ตามแบบใน Preview/html
import Link from "next/link";
import { hasPermission } from "@/backend/lib/authz/scope";
import { formatPct } from "@/backend/lib/format";
import { Icon } from "./icons";
import { Money, MoneyUnit } from "./money";
import type { CurrentUser } from "@/backend/lib/session";

/** สีสายของตัวชี้วัด — ใช้กับป้ายวงกลมหน้า KPI (op สีอ่อน จึงใช้ตัวอักษรเข้ม) */
const LINES = {
  rev: "var(--line-rev)",
  gp: "var(--line-gp)",
  op: "var(--line-op)",
  pbt: "var(--line-pbt)",
  msp: "var(--line-msp)",
  ink: "var(--pill)",
} as const;
export type LineKey = keyof typeof LINES;

/** ป้ายวงกลมแบบรหัสสถานี: สีสาย + รหัสสั้น (REV, GP …) */
export function Roundel({ line, code, small = false }: { line: LineKey; code: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`roundel ${small ? "roundel-sm" : ""}`}
      data-light={line === "op" || undefined}
      style={{ "--line-c": LINES[line], ...(line === "ink" ? { color: "var(--pill-fg)" } : {}) } as React.CSSProperties}
    >
      {code}
    </span>
  );
}

/** KPI แบบเม็ดยา: ป้ายวงกลมสีสาย · ชื่อ · ตัวเลขใหญ่ · หมายเหตุ */
export function Kpi({
  label, value, unit, line, code, note, negative,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  line: LineKey;
  code: string;
  note?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-head">
        <Roundel line={line} code={code} small />
        <div className="min-w-0 truncate text-sm font-medium text-ink-2">{label}</div>
      </div>
      <div className="kpi-body">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className={`num min-w-0 truncate text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] ${negative ? "text-loss-text" : "text-ink"}`}>
            {value}
          </span>
          {unit && <span className="shrink-0 text-[0.8125rem] text-ink-3">{unit}</span>}
        </div>
        {note && <div className="kpi-note num mt-0.5 text-[0.8125rem] leading-snug text-ink-3">{note}</div>}
      </div>
    </div>
  );
}

/** KPI เงิน แสดงตามรูปแบบที่ผู้ใช้เลือก (ปกติ / ทศนิยม / ย่อ K/M) */
export function MoneyKpi({ label, value, line, code, note }: { label: string; value: number; line: LineKey; code: string; note?: React.ReactNode }) {
  return <Kpi label={label} value={<Money value={value} />} unit={<MoneyUnit long />} line={line} code={code} note={note} negative={value < 0} />;
}

/** หัวแผงสรุป (จุดเด่น / ประเด็นติดตาม) พร้อมไอคอนในวงกลม */
export function PanelTitle({ tone, children }: { tone: "good" | "bad" | "warn"; children: React.ReactNode }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-loss-text" : "text-(--warn-text)";
  return (
    <h3 className={`panel-title ${color}`}>
      <span className="grid size-5 place-items-center rounded-full bg-surface">
        <Icon name={tone === "good" ? "check" : "alert"} size={tone === "good" ? 12 : 14} stroke={tone === "good" ? 3 : 2.2} />
      </span>
      {children}
    </h3>
  );
}

/**
 * ลูกศรเปลี่ยนแปลง ▲▼ — `goodWhenUp=false` สำหรับต้นทุน/ค่าใช้จ่าย (เพิ่มขึ้นคือแย่)
 * `points` = เปลี่ยนเป็นจุด % (ใช้กับอัตราส่วน)
 */
export function Delta({ value, goodWhenUp = true, points = false, label }: { value: number | null; goodWhenUp?: boolean; points?: boolean; label?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-ink-3">—</span>;
  if (Math.abs(value) < 0.05) return <span className="text-ink-2">คงที่{label ? ` ${label}` : ""}</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span className={`num inline-flex items-center gap-0.5 font-semibold ${good ? "text-good" : "text-loss-text"}`}>
      <Icon name={up ? "up" : "down"} size={13} stroke={2.4} />
      <span className="sr-only">{up ? "เพิ่มขึ้น" : "ลดลง"}</span>
      {Math.abs(value).toFixed(1)}
      {points ? " จุด" : "%"}
      {label ? <span className="font-normal text-ink-2"> {label}</span> : null}
    </span>
  );
}

/** ช่องหนึ่งใน <RatioStrip> */
export function Ratio({ label, value, delta }: { label: string; value: number | null; delta?: React.ReactNode }) {
  return (
    <div className="ratio-card">
      <div className="text-[0.8125rem] text-ink-3">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`num text-lg font-semibold ${value != null && value < 0 ? "text-loss-text" : "text-navy"}`}>{formatPct(value)}</span>
        {delta && <span className="text-xs">{delta}</span>}
      </div>
    </div>
  );
}

/** แถบอัตราส่วนรวมในกรอบเดียว */
export function RatioStrip({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="อัตราส่วน" className="ratio-strip">
      {children}
    </section>
  );
}

/**
 * แถวจัดอันดับพร้อมแถบ: ใช้ใน Ranking ทุกหน้า
 * มี href = กดได้ทั้งแถว (ไม่ใช่แค่ชื่อ) สูงอย่างน้อย 44px · ชี้แล้วพื้นหลังขึ้น + ลูกศรบอกว่ากดดูงบได้
 * ระยะขอบติดลบ/ระยะในคงที่ทุกสถานะ — ชี้/เลือกแล้วแถวไม่ขยับ
 */
export function RankBar({
  label, href, active = false, pct, display, tone = "brand", badge,
}: {
  label: React.ReactNode;
  href?: string;
  /** แถวที่กำลังเปิดดูรายละเอียดอยู่ */
  active?: boolean;
  pct: number;
  display: React.ReactNode;
  tone?: "brand" | "loss" | "good";
  badge?: React.ReactNode;
}) {
  const color = tone === "loss" ? "bg-loss" : tone === "good" ? "bg-good" : "bg-(--line-rev)";
  const content = (
    <>
      <div className={`w-36 shrink-0 truncate text-[0.8125rem] font-semibold sm:w-40 ${active ? "text-brand" : href ? "group-hover:text-brand group-hover:underline" : ""}`}>
        {label}
      </div>
      <div className="track flex-1" aria-hidden>
        <div className={`bar-fill h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
      <div className="num w-24 shrink-0 text-right text-[0.8125rem]">{display}</div>
      {badge !== undefined && <div className="rank-badge w-20 shrink-0 text-right">{badge}</div>}
      {href && (
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`shrink-0 transition-[color,transform] duration-150 ${active ? "text-brand" : "text-ink-3 group-hover:translate-x-0.5 group-hover:text-brand"}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </>
  );
  const rowClass = `rank-row -mx-2.5 flex min-h-11 items-center gap-3 rounded-[14px] border-b border-line px-2.5 py-2 last:border-0 ${active ? "border-transparent bg-brand-soft" : ""}`;
  if (!href) return <div className={rowClass}>{content}</div>;
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`group ${rowClass} transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${active ? "" : "hover:border-transparent hover:bg-surface-2"}`}
    >
      {content}
    </Link>
  );
}

export function InfoRow({ label, value, sub }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-[0.8125rem] last:border-0">
      <span className="shrink-0 whitespace-nowrap text-ink-2">{label}</span>
      <span className="min-w-0 text-right">
        <b className="font-semibold">{value}</b>
        {sub && <span className="num ml-1.5 text-xs text-ink-2">{sub}</span>}
      </span>
    </div>
  );
}

/** แท็บเลือกแบบลิงก์ (เก็บสถานะใน URL) */
export function SegLinks({ items, label }: { items: { href: string; label: string; active: boolean }[]; label: string }) {
  return (
    <nav className="seg flex-wrap" aria-label={label}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} scroll={false} aria-current={i.active ? "true" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mx-auto mt-10 max-w-lg px-8 py-10 text-center">
      <span aria-hidden className="mx-auto mb-5 flex w-40 items-center">
        <span className="size-4 rounded-full border-4 border-(--line-msp) bg-surface" />
        <span className="h-1.5 flex-1 rounded-full bg-(--route-off)" />
        <span className="size-4 rounded-full border-4 border-(--route-off) bg-surface" />
      </span>
      <h1 className="text-xl font-semibold text-navy text-balance">{title}</h1>
      <div className="mt-2 text-ink-2">{children}</div>
    </section>
  );
}

export function NoData({ user }: { user: CurrentUser }) {
  if (user.closure.length > 0 && !user.defaultUnit) {
    return <Empty title="บัญชีนี้ยังไม่ได้รับสิทธิ์ดูหน่วยใด">ติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยที่ต้องการดู</Empty>;
  }
  return (
    <Empty title="ยังไม่มีข้อมูลงบกำไรขาดทุน">
      {hasPermission(user, "data.upload") ? (
        <Link href="/upload" className="btn-primary mt-5">นำเข้าไฟล์ Excel ของเดือนแรก</Link>
      ) : (
        "รอฝ่ายบัญชีนำเข้าข้อมูล"
      )}
    </Empty>
  );
}

/** เลือกงวดจาก ?period= ถ้าไม่ถูกต้องใช้งวดล่าสุด */
export function pickPeriod(periods: string[], requested: string | undefined) {
  return requested && periods.includes(requested) ? requested : periods[0];
}

/**
 * งวดที่ดูจาก ?period= — เดือนเดียว ("2026-08-01"), หลายเดือนคั่นด้วยจุลภาค ("2026-01-01,2026-02-01") หรือ "all" = ทุกงวดที่มี
 * ตัดงวดที่ไม่มีข้อมูลทิ้ง ไม่เหลือเลยใช้งวดล่าสุด · list เรียงเก่า → ใหม่ · param = ค่าที่ใส่กลับใน URL
 */
export function pickPeriods(periods: string[], requested: string | undefined) {
  const all = requested === "all" && periods.length > 1;
  const wanted = all ? periods : [...new Set((requested ?? "").split(","))].filter((p) => periods.includes(p));
  // คัดลอกก่อนเรียง — periods ของผู้เรียก (ใหม่ → เก่า) ต้องไม่ถูกเรียงตาม
  const list = [...(wanted.length ? wanted : [periods[0]])].sort();
  return {
    list,
    /** เดือนเดียว = string (ใช้กับ getStatement ได้ตรงๆ) · หลายเดือน = array */
    sel: list.length === 1 ? list[0] : list,
    /** งวดล่าสุดในชุดที่เลือก */
    last: list[list.length - 1],
    all,
    multi: list.length > 1,
    param: all ? "all" : list.join(","),
  };
}
export type PeriodPick = ReturnType<typeof pickPeriods>;

export function readParam(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}
