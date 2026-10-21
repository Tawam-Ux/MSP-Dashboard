import { formatBahtDecimal, formatSignedPct } from "@/backend/lib/format";
import type { Statement } from "@/backend/lib/statement";
import { Delta } from "./dash";
import { Money } from "./money";

type Step = {
  key: string;
  label: string;
  /** ระดับก่อน → หลังสถานีนี้ (บาท) · ยอดรวมเริ่มจาก 0 · รายการหักเริ่มจากยอดรวมก่อนหน้า */
  from: number;
  to: number;
  kind: "total" | "less";
  color: string;
};

/** รายได้ → หักต้นทุน → กำไรขั้นต้น → หักขาย/บริหาร → กำไรดำเนินงาน → หักค่าเสื่อม/ดอกเบี้ย → กำไรก่อนภาษี */
function stepsOf({ totals: t }: Statement): Step[] {
  return [
    { key: "rev", label: "รายได้รวม", from: 0, to: t.REV, kind: "total", color: "var(--line-rev)" },
    { key: "cost", label: "ต้นทุนเพื่อขาย", from: t.REV, to: t.GP, kind: "less", color: "var(--seg-cogs)" },
    { key: "gp", label: "กำไรขั้นต้น", from: 0, to: t.GP, kind: "total", color: "var(--line-gp)" },
    { key: "sga", label: "ค่าใช้จ่ายขายและบริหาร", from: t.GP, to: t.OP, kind: "less", color: "var(--seg-admin)" },
    { key: "op", label: "กำไรจากการดำเนินงาน", from: 0, to: t.OP, kind: "total", color: "var(--line-op)" },
    { key: "fin", label: "ค่าเสื่อมและดอกเบี้ย", from: t.OP, to: t.PBT, kind: "less", color: "var(--seg-finance)" },
    { key: "pbt", label: t.PBT < 0 ? "ขาดทุนก่อนภาษี" : "กำไรก่อนภาษี", from: 0, to: t.PBT, kind: "total", color: t.PBT < 0 ? "var(--loss)" : "var(--line-pbt)" },
  ];
}

/** ยอดแบบย่อสำหรับจอแคบ: 10 ล้านขึ้นไปไม่มีทศนิยม (335M) · ต่ำกว่านั้นทศนิยม 1 ตำแหน่ง (4.1M) — 7 สถานีพอดีจอ 390px */
const tiny = [0, 1].map((d) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: d }));
const formatTiny = (n: number) => tiny[Math.abs(n) >= 1e7 ? 0 : 1].format(Math.round(n));

/**
 * การเปลี่ยนเทียบงวดก่อน ใต้ % ของสถานี: ต้นทุน/ค่าใช้จ่ายเพิ่ม = แดง · กำไรเพิ่ม = เขียว
 * สถานีรายได้รวม (100% เสมอ) บอกรายได้ที่เพิ่ม/ลด เป็น % ของรายได้เดือนก่อน และเป็นบาท (จอแคบแสดงเฉพาะ %)
 */
function StepDelta({ step, now, then, revenue }: { step: Step; now: number | null; then: number | null; revenue?: { now: number; then: number } }) {
  if (step.key === "rev" && revenue) {
    const diff = revenue.now - revenue.then;
    return (
      <span className="bridge-delta">
        <Delta value={revenue.then === 0 ? null : (diff / Math.abs(revenue.then)) * 100} />
        <span className={`bridge-delta-amt num ${diff < 0 ? "text-loss-text" : "text-good"}`}>
          {" "}({diff < 0 ? "−" : "+"}<Money value={Math.abs(diff)} />)
        </span>
      </span>
    );
  }
  if (step.key === "rev" || now == null || then == null) return <span className="bridge-delta" aria-hidden>&nbsp;</span>;
  return (
    <span className="bridge-delta">
      <Delta value={now - then} goodWhenUp={step.kind === "total"} />
    </span>
  );
}

/** เครื่องหมายหน้าตัวเลข: รายการหัก − = ลดกำไร · + = เพิ่มกำไร (เช่น ต้นทุนติดลบจากการกลับรายการ) · ยอดรวมติดลบ = − */
const signOf = (kind: Step["kind"], shown: number) => (kind === "less" ? (shown > 0 ? "−" : shown < 0 ? "+" : "") : shown < 0 ? "−" : "");

/**
 * สะพานกำไร (waterfall) วางบนสายรถไฟ: ออกจากสถานีรายได้ ทุกสถานีหักต้นทุน/ค่าใช้จ่าย จนถึงปลายทางกำไรก่อนภาษี
 * แท่งยอดรวม = สีทึบยืนบนเส้น 0 · แท่งรายการหัก = สีอ่อนลอยจากยอดก่อนหน้าลงมาถึงยอดถัดไป · เส้นบางเชื่อมระดับระหว่างสถานี
 * % ของรายได้เป็นป้ายเหนือหัวแท่ง · ใต้สถานี = ยอดเงิน ชื่อ และการเปลี่ยนเทียบงวดก่อน
 * ชี้/โฟกัสแท่ง = ยอดบาทเต็มและ % ของรายได้ · จอแคบแสดงยอดแบบย่อ (K/M) ให้ครบ 7 สถานีในการ์ด
 */
export function ProfitBridge({ statement, previous }: { statement: Statement; previous?: Statement }) {
  const steps = stepsOf(statement);
  const rev = statement.totals.REV;
  // % ของรายได้ของแต่ละขั้นในงวดก่อน (มุมมองรายเดือน) — ใช้บอกการเปลี่ยนใต้ % ของสถานี
  const before = previous ? stepsOf(previous) : null;
  const pctOf = (s: Step, r: number) => (r === 0 ? null : ((s.kind === "less" ? s.from - s.to : s.to) / r) * 100);
  const levels = steps.flatMap((s) => [s.from, s.to]);
  const lo = Math.min(0, ...levels);
  const hi = Math.max(0, ...levels);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="bridge-scroll">
      <ol className="bridge" data-below={lo < 0 || undefined} style={{ "--zero": `${pos(0)}%` } as React.CSSProperties}>
        {steps.map((s, i) => {
          const amount = s.to - s.from;
          // รายการหักแสดงเป็นยอดที่หักออก (บวก = ลดกำไร) · ยอดรวมแสดงตามจริง
          const shown = s.kind === "less" ? -amount : s.to;
          const pct = rev === 0 ? null : (shown / rev) * 100;
          const negative = s.kind === "total" && s.to < 0;
          const end = i === steps.length - 1;
          const sign = signOf(s.kind, shown);
          const exact = `${sign}${formatBahtDecimal(Math.abs(shown))} บาท`;
          return (
            <li
              key={s.key}
              className="bridge-col"
              data-kind={s.kind}
              data-end={end || undefined}
              data-neg={negative || undefined}
              tabIndex={0}
              aria-label={`${s.label} ${exact} ${formatSignedPct(pct)} ของรายได้`}
              style={{ "--i": i, "--c": s.color } as React.CSSProperties}
            >
              <div className="bridge-plot" aria-hidden>
                {/* พื้นที่แท่ง (เว้นหัวไว้ให้ป้าย %) · ป้าย % ลอยเหนือหัวแท่ง แท่งเล็กแค่ไหนก็อ่านได้ */}
                <div className="bridge-area">
                  <span
                    className="bridge-bar"
                    style={{ bottom: `${pos(Math.min(s.from, s.to))}%`, height: `${(Math.abs(amount) / span) * 100}%` }}
                  />
                  {!end && <span className="bridge-link" style={{ bottom: `${pos(s.to)}%` }} />}
                  <span className="bridge-tag num" style={{ bottom: `${pos(Math.max(s.from, s.to, 0))}%` }}>
                    {formatSignedPct(s.kind === "less" && pct != null ? Math.abs(pct) : pct)}
                  </span>
                </div>
                <span className="bridge-tip num">{exact} · {formatSignedPct(pct)}</span>
              </div>
              <span className="bridge-stop" aria-hidden />
              <div className="bridge-label" aria-hidden>
                <strong className="num">
                  <span className="bridge-full">{sign}<Money value={Math.abs(shown)} /></span>
                  <span className="bridge-compact">{sign}{formatTiny(Math.abs(shown))}</span>
                </strong>
                <span className="bridge-name">{s.label}</span>
                {before && (
                  <StepDelta step={s} now={pct} then={pctOf(before[i], previous!.totals.REV)} revenue={{ now: rev, then: previous!.totals.REV }} />
                )}
                {end && negative && <span className="badge badge-bad mt-1">ขาดทุน</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
