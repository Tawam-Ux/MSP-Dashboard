import { ratioOf } from "@/backend/lib/analysis";
import type { Statement } from "@/backend/lib/statement";
import { Roundel, type LineKey } from "./dash";
import { Money, MoneyUnit } from "./money";
import { StatementTable } from "./statement-table";
import { formatPct } from "@/backend/lib/format";
import { ACCOUNT_DETAIL_ENABLED } from "@/backend/lib/account-detail";
import { AccountDetailScope } from "./account-detail";
import { PendingLink } from "./nav-pending";

export const UNIT_DETAIL_ID = "unit-detail";

/**
 * รายละเอียดหน่วยที่เลือก แสดงในหน้าเดียวกับการ์ดที่คลิก (ไม่พาไปหน้าอื่น)
 * closeHref = ลิงก์ของหน้าเดิมโดยไม่มี ?unit=
 * source = รหัสหน่วยและงวดที่ดู — มี (และเปิดฟีเจอร์อยู่) = กดชื่อรายการในงบเพื่อดูบัญชีย่อยจากชีต MASTER_ ได้
 *
 * การ์ดซ้ายสูงเท่างบกำไรขาดทุนด้านขวา (grid ยืดเท่ากัน) — สี่ขั้นกำไรกระจายเต็มความสูง ไม่เหลือที่ว่างใต้การ์ด
 */
export function UnitDetail({ title, name, statement, closeHref, source }: {
  title: string; name: string; statement: Statement; closeHref: string;
  source?: { unit: string; periods: string[]; periodLabel: string };
}) {
  const t = statement.totals;
  const steps: { key: string; label: string; value: number; line: LineKey; margin: string }[] = [
    { key: "REV", label: "รายได้รวม", value: t.REV, line: "rev", margin: "ฐาน 100%" },
    { key: "GP", label: "กำไรขั้นต้น", value: t.GP, line: "gp", margin: "GP Margin" },
    { key: "OP", label: "กำไรจากการดำเนินงาน", value: t.OP, line: "op", margin: "OP Margin" },
    { key: "PBT", label: "กำไรก่อนภาษี", value: t.PBT, line: "pbt", margin: "PBT Margin" },
  ];
  return (
    <div id={UNIT_DETAIL_ID} className="reveal grid scroll-mt-24 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="card flex flex-col" aria-labelledby="unit-detail-title">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="unit-detail-title" className="truncate text-xl leading-snug font-semibold tracking-[-0.01em] text-ink">{name}</h2>
            <p className="mt-0.5 text-[0.8125rem] text-pretty text-ink-3">{title} · หน่วย <MoneyUnit long /></p>
          </div>
          {/* ปุ่มปิดแบบเม็ดยามีพื้นและคำว่า "ปิด" — กากบาทเปล่าสีจางกลืนกับการ์ด */}
          {/* ปิดแล้วขึ้น skeleton ของหน้าหลักทันที ไม่ค้างหน้ารายละเอียดจนหน้าหลักโหลดเสร็จ */}
          <PendingLink
            href={closeHref}
            scroll={false}
            aria-label={`ปิดรายละเอียด ${name}`}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-2 pr-4 pl-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            ปิด
          </PendingLink>
        </div>

        {/* สี่ขั้นจากรายได้ลงไปถึงกำไรก่อนภาษี · แถบใต้ตัวเลข = สัดส่วนต่อรายได้ (รายได้เต็มแถบ) */}
        <div className="mt-5 flex flex-1 flex-col">
          {steps.map((s) => (
            <Step key={s.key} code={s.key} label={s.label} value={s.value} revenue={t.REV} line={s.line} margin={s.margin} />
          ))}
        </div>

        {/* อัตราส่วนฝั่งต้นทุน — สองช่องกว้างเท่ากัน ปิดท้ายการ์ด */}
        <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-[18px] bg-surface-2">
          <Ratio label="Cost Ratio" hint="ต้นทุนขาย / รายได้" value={formatPct(ratioOf(t.TOTAL_COST, t.REV))} />
          <Ratio label="SG&A Ratio" hint="ค่าใช้จ่ายขายและบริหาร / รายได้" value={formatPct(ratioOf(t.SGA, t.REV))} divider />
        </dl>
      </section>
      {ACCOUNT_DETAIL_ENABLED && source ? (
        <AccountDetailScope source={{ ...source, unitName: name }}>
          <StatementTable statement={statement} clickable />
        </AccountDetailScope>
      ) : (
        <StatementTable statement={statement} />
      )}
    </div>
  );
}

function Step({ code, label, value, revenue, line, margin }: { code: string; label: string; value: number; revenue: number; line: LineKey; margin: string }) {
  const loss = value < 0;
  const ratio = ratioOf(value, revenue);
  const width = ratio == null ? 0 : Math.min(100, Math.abs(ratio));
  const isBase = code === "REV";
  return (
    <div className="flex flex-1 items-center gap-3.5 border-b border-line py-3 last:border-0">
      <Roundel line={line} code={code} small />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          {/* ขาดทุนบอกด้วยป้ายคำ + เครื่องหมายลบ ไม่พึ่งสีแดงอย่างเดียว */}
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-2">
            <span className="truncate">{label}</span>
            {loss && <span className="badge badge-bad shrink-0">ขาดทุน</span>}
          </span>
          <span className={`num shrink-0 text-xl leading-tight font-semibold tracking-[-0.01em] ${loss ? "text-loss-text" : "text-ink"}`}>
            <Money value={value} />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span
              className="block h-full rounded-full"
              style={{ width: `${width}%`, background: loss ? "var(--loss)" : `var(--line-${line})` }}
            />
          </span>
          <span className="num w-[7.25rem] shrink-0 sm:w-[8.5rem] text-right text-xs text-ink-3">
            {isBase ? (
              margin
            ) : (
              <>
                {margin} <b className={`font-semibold ${loss ? "text-loss-text" : "text-ink-2"}`}>{formatPct(ratio)}</b>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function Ratio({ label, hint, value, divider = false }: { label: string; hint: string; value: string; divider?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-3 ${divider ? "border-l border-line" : ""}`} title={hint}>
      <dt className="truncate text-xs text-ink-2">{label}</dt>
      <dd className="num mt-0.5 text-lg leading-tight font-semibold text-ink">{value}</dd>
    </div>
  );
}
