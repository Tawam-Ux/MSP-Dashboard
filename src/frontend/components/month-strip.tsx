import { MONTHS_SHORT } from "@/backend/lib/format";
import { SignedMoney } from "./money";

export type StripMonth = {
  /** 1–12 */
  month: number;
  /** กำไรก่อนภาษีของเดือน · null = ยังไม่ปิดงบ (ไม่มีในชีต Monthy) */
  pbt: number | null;
  /** อยู่ในเดือนที่เลือกที่ตัวกรองเดือน (เลือกได้หลายเดือน) */
  current: boolean;
};

/**
 * กำไรก่อนภาษี 12 เดือนเป็นแท่งบนเส้นศูนย์: กำไรตั้งขึ้น ขาดทุนห้อยลงเป็นแดง · เดือนที่เลือกเป็นสีสายกำไรก่อนภาษี เดือนอื่นเทาจาง
 * แสดงผลอย่างเดียว — เปลี่ยนเดือนที่ตัวกรองเดือนบนหัวหน้า
 */
export function MonthStrip({ months }: { months: StripMonth[] }) {
  const values = months.flatMap((m) => (m.pbt == null ? [] : [m.pbt]));
  const up = Math.max(0, ...values);
  const down = Math.max(0, ...values.map((v) => -v));
  const span = up + down || 1;
  return (
    <ol className="mstrip" style={{ "--zero": `${(down / span) * 100}%` } as React.CSSProperties}>
      {months.map((m) => {
        const closed = m.pbt != null;
        const loss = closed && m.pbt! < 0;
        return (
          <li
            key={m.month}
            className="mstrip-month"
            data-state={!closed ? "off" : m.current ? "now" : "out"}
            data-loss={loss || undefined}
          >
            <span className="mstrip-link" aria-current={m.current ? "true" : undefined}>
              <span className="mstrip-plot" aria-hidden>
                {closed && (
                  <span className="mstrip-bar" style={{ height: `${Math.max(2, (Math.abs(m.pbt!) / span) * 100)}%` }} />
                )}
              </span>
              <span className="mstrip-name">{MONTHS_SHORT[m.month - 1]}</span>
              <span className="mstrip-val num">
                {closed ? (
                  <>
                    {!loss && "+"}
                    <SignedMoney value={m.pbt!} />
                  </>
                ) : (
                  "ยังไม่ปิดงบ"
                )}
              </span>
              {loss && <span className="badge badge-bad mstrip-badge">ขาดทุน</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
