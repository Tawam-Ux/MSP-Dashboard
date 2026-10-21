import Link from "next/link";
import { Delta } from "@/frontend/components/dash";
import { Money, MoneyUnit } from "@/frontend/components/money";
import { changePct, financeCost } from "@/backend/lib/analysis";
import { formatBaht } from "@/backend/lib/format";
import { sumStatements, type Statement } from "@/backend/lib/statement";

export type BridgeUnit = { code: string; name: string; now: Statement; before: Statement };

/** ส่วนต่างที่บวก/ลบ กำไรก่อนภาษี — แสดงเครื่องหมายเสมอ (ไม่บอกด้วยสีอย่างเดียว) */
function Signed({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <span className="text-ink-3">0</span>;
  return (
    <span className={value > 0 ? "text-good" : "text-loss-text"}>
      {value > 0 ? "+" : "−"}
      <Money value={Math.abs(value)} />
    </span>
  );
}

/**
 * สะพานกำไร: PBT งวดเปรียบเทียบ → ผลของรายได้ ต้นทุน ค่าใช้จ่าย ค่าเสื่อม/ดอกเบี้ย → PBT งวดนี้
 * ทุกขั้นเป็นส่วนต่างของยอดในงบ จึงรวมกันได้ PBT งวดนี้พอดี (PBT = REV − ต้นทุน − ขาย − บริหาร − ค่าเสื่อม/ดอกเบี้ย)
 * ขอบเขต = หน่วยปฏิบัติการทั้งหมด (รวมศูนย์ต้นทุน) ตรงกับ KPI ด้านบน · ใต้สะพาน: หน่วยที่ทำให้ PBT เปลี่ยนมากสุด
 * units = null → ไม่มีข้อมูลงวดเปรียบเทียบ
 */
export function ProfitBridge({
  units, periodLabel, baseLabel, baseNote, hrefFor,
}: {
  units: BridgeUnit[] | null;
  periodLabel: string;
  baseLabel: string;
  /** หมายเหตุเมื่องวดเปรียบเทียบมีข้อมูลไม่ครบ */
  baseNote?: string;
  hrefFor: (code: string) => string;
}) {
  return (
    <section className="card card-fixed card-lg">
      <h2 className="card-title">สะพานกำไร</h2>
      <p className="card-cap">
        กำไรก่อนภาษีของหน่วยปฏิบัติการ เปลี่ยนจาก {baseLabel} เพราะอะไร (<MoneyUnit long />)
        {baseNote && <> · {baseNote}</>}
      </p>
      {units == null ? (
        <p className="rounded-(--r-inner) bg-surface-2 px-4 py-8 text-center text-sm text-ink-2 text-balance">
          ยังไม่มีข้อมูล {baseLabel} จึงยังเทียบไม่ได้ · นำเข้าข้อมูลของงวดนั้นแล้วการ์ดนี้จะแสดงว่ากำไรเปลี่ยนเพราะอะไร
        </p>
      ) : (
        <BridgeBody units={units} periodLabel={periodLabel} baseLabel={baseLabel} hrefFor={hrefFor} />
      )}
    </section>
  );
}

function BridgeBody({ units, periodLabel, baseLabel, hrefFor }: { units: BridgeUnit[]; periodLabel: string; baseLabel: string; hrefFor: (code: string) => string }) {
  const now = sumStatements(units.map((u) => u.now));
  const before = sumStatements(units.map((u) => u.before));
  const n = now.totals;
  const b = before.totals;

  // effect = ผลต่อกำไร: รายได้เพิ่ม = กำไรเพิ่ม · ต้นทุน/ค่าใช้จ่ายเพิ่ม = กำไรลด
  type Step =
    | { kind: "total"; label: string; value: number }
    | { kind: "effect"; label: string; now: number; before: number; effect: number; upGood: boolean };
  const effect = (label: string, nowV: number, beforeV: number, upGood: boolean): Step => ({
    kind: "effect", label, now: nowV, before: beforeV, upGood, effect: upGood ? nowV - beforeV : beforeV - nowV,
  });
  const steps: Step[] = [
    { kind: "total", label: `PBT ${baseLabel}`, value: b.PBT },
    effect("รายได้", n.REV, b.REV, true),
    effect("ต้นทุนขาย", n.TOTAL_COST, b.TOTAL_COST, false),
    effect("ค่าใช้จ่ายขาย", n.SELLING, b.SELLING, false),
    effect("ค่าใช้จ่ายบริหาร", n.ADMIN, b.ADMIN, false),
    effect("ค่าเสื่อมและดอกเบี้ย", financeCost(now), financeCost(before), false),
    { kind: "total", label: `PBT ${periodLabel}`, value: n.PBT },
  ];

  let running = 0;
  const bars = steps.map((s) => {
    const start = s.kind === "total" ? 0 : running;
    const end = s.kind === "total" ? s.value : running + s.effect;
    running = end;
    return { step: s, start, end };
  });
  const lo = Math.min(0, ...bars.flatMap((x) => [x.start, x.end]));
  const hi = Math.max(0, ...bars.flatMap((x) => [x.start, x.end]));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  const change = n.PBT - b.PBT;
  const movers = units
    .map((u) => ({ ...u, diff: u.now.totals.PBT - u.before.totals.PBT }))
    .filter((u) => Math.abs(u.diff) >= 1)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const maxMove = Math.max(1, ...movers.map((m) => Math.abs(m.diff)));

  return (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-(--r-inner) bg-surface-2 px-4 py-3">
        <span className="text-[0.8125rem] text-ink-2">PBT เปลี่ยนไป</span>
        <span className="num flex items-baseline gap-2">
          <span className="text-lg font-semibold"><Signed value={change} /></span>
          <span className="text-xs"><Delta value={changePct(n.PBT, b.PBT)} /></span>
        </span>
      </div>

      <div className="card-body">
        <ol aria-label="ขั้นของสะพานกำไร" className="space-y-1">
          {bars.map(({ step: s, start, end }) => {
            const total = s.kind === "total";
            const color = total ? (s.value < 0 ? "var(--loss)" : "var(--line-pbt)") : s.effect >= 0 ? "var(--good)" : "var(--loss)";
            const amount = total ? s.value : s.effect;
            return (
              <li key={s.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 py-1 text-[0.8125rem] sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
                <span className="min-w-0">
                  <span className={`block truncate ${total ? "font-semibold text-navy" : "text-ink-2"}`}>{s.label}</span>
                  {!total && (
                    <span className="block text-xs">
                      <Delta value={changePct(s.now, s.before)} goodWhenUp={s.upGood} />
                    </span>
                  )}
                </span>
                <div className="relative h-6" title={`${s.label} ${formatBaht(amount)} บาท`} aria-hidden>
                  {lo < 0 && <div className="absolute inset-y-0 w-0.5 rounded-full bg-line-strong" style={{ left: `${pos(0)}%` }} />}
                  <div
                    className="bar-fill absolute inset-y-0.5 rounded-full"
                    style={{
                      left: `${pos(Math.min(start, end))}%`,
                      width: `${Math.max(0.6, Math.abs(pos(end) - pos(start)))}%`,
                      background: color,
                      opacity: total ? 1 : 0.85,
                    }}
                  />
                </div>
                <span className={`num text-right ${total ? "font-semibold" : ""} ${total && s.value < 0 ? "text-loss-text" : ""}`}>
                  {total ? <Money value={s.value} /> : <Signed value={s.effect} />}
                </span>
              </li>
            );
          })}
        </ol>

        <h3 className="mt-5 mb-1 text-[0.8125rem] font-semibold text-navy">หน่วยที่ทำให้กำไรเปลี่ยนมากสุด</h3>
        {movers.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-3">PBT ของทุกหน่วยเท่ากับ {baseLabel}</p>
        ) : (
          <ul aria-label="ส่วนต่าง PBT รายหน่วย">
            {movers.map((m) => (
              <li key={m.code} className="border-b border-line last:border-0">
                <Link
                  href={hrefFor(m.code)}
                  className="group -mx-2.5 grid min-h-11 grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 rounded-[14px] px-2.5 py-2 text-[0.8125rem] transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:grid-cols-[minmax(0,11rem)_1fr_auto]"
                >
                  <span className="truncate font-semibold group-hover:text-brand group-hover:underline">{m.name}</span>
                  {/* แถบสองทาง: กำไรเพิ่มไปขวา ลดไปซ้ายของเส้นกลาง */}
                  <span className="relative h-2.5" aria-hidden>
                    <span className="absolute inset-y-[-3px] left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-line-strong" />
                    <span
                      className={`bar-fill absolute inset-y-0 rounded-full ${m.diff > 0 ? "bg-good" : "bg-loss"}`}
                      style={{
                        width: `${Math.max(1, (Math.abs(m.diff) / maxMove) * 50)}%`,
                        ...(m.diff > 0 ? { left: "50%" } : { right: "50%" }),
                      }}
                    />
                  </span>
                  <span className="num text-right"><Signed value={m.diff} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
