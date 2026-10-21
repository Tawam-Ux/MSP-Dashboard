import { formatBahtDecimal, formatPct } from "@/backend/lib/format";
import { Money } from "@/frontend/components/money";
import { visibleStatementLines, type Statement } from "@/backend/lib/statement";

/** ความกว้างข้อความตัวเลขโดยประมาณ หน่วย ch (ตัวเลขแบบ tabular กว้าง 1ch เท่ากันทุกตัว · , และ . แคบ · % กว้างกว่า) */
const textCh = (s: string) => [...s].reduce((w, c) => w + (c === "," || c === "." ? 0.35 : c === "%" ? 1.4 : 1), 0);

/** clickable = ชื่อบัญชีเป็นปุ่มเปิดรายละเอียด (ป๊อปอัปใน AccountDetailScope ที่ครอบการ์ดนี้ จับคลิกจาก data-account-group) */
export function StatementTable({ statement, clickable = false }: { statement: Statement; clickable?: boolean }) {
  const lines = visibleStatementLines(statement.lines);
  // ความกว้างคอลัมน์ตัวเลข = ตัวเลขยาวสุดของงบนี้ในแบบทศนิยม (ยาวสุดในทุกรูปแบบ) — ไม่ขึ้นกับรูปแบบที่เลือก หัวคอลัมน์จึงไม่ขยับตอนสลับ
  // งบเล็กได้คอลัมน์แคบ เหลือที่ให้ชื่อรายการ · +0.6 เผื่อตัวหนาในแถวยอดรวม
  const values = lines.flatMap((l) => (l.kind === "heading" ? [] : [l]));
  const numCh = Math.max(0, ...values.map((l) => textCh(formatBahtDecimal(l.value)))) + 0.6;
  const pctCh = Math.max(0, ...values.map((l) => textCh(formatPct(l.pctOfRevenue)))) + 0.6;
  return (
    <section aria-labelledby="statement-heading" className="card card-fixed card-xl">
      <h2 id="statement-heading" className="card-title mb-4">งบกำไรขาดทุน</h2>
      <div className="card-body">
        {/* table-fixed + คอลัมน์ตัวเลขกว้างตาม numCh/pctCh (หน่วย ch = ความกว้างตัวเลข 1 ตัว) + ช่องว่างซ้ายขวาของเซลล์
            ไม่แคบกว่าหัวคอลัมน์ · คอลัมน์ "รายการ" รับพื้นที่ที่เหลือ ชื่อยาวขึ้นบรรทัดใหม่แทนการดันคอลัมน์ตัวเลข */}
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ "--num-w": `${numCh}ch`, "--pct-w": `${pctCh}ch` } as React.CSSProperties}
        >
          <colgroup>
            <col />
            <col className="w-[max(3.5rem,calc(var(--num-w)_+_1rem))] sm:w-[max(3.5rem,calc(var(--num-w)_+_1.5rem))]" />
            <col className="w-[max(4.75rem,calc(var(--pct-w)_+_1.375rem))] sm:w-[max(4.75rem,calc(var(--pct-w)_+_1.75rem))]" />
          </colgroup>
          <thead>
            <tr className="text-left text-[0.8125rem] text-ink-2">
              <th scope="col" className="rounded-l-full bg-surface-2 px-3.5 py-2 font-medium">รายการ</th>
              <th scope="col" className="bg-surface-2 px-2 py-2 text-right font-medium whitespace-nowrap sm:px-3">งวดนี้</th>
              <th scope="col" className="rounded-r-full bg-surface-2 py-2 pr-3.5 pl-2 text-right font-medium whitespace-nowrap sm:pl-3.5">% รายได้</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              if (line.kind === "heading") {
                return (
                  <tr key={i}>
                    <th colSpan={3} scope="colgroup" className="px-3.5 pt-4 pb-1 text-left text-xs font-semibold text-ink-3">
                      {line.name}
                    </th>
                  </tr>
                );
              }
              const major = line.kind === "total" && line.emphasis === "major";
              const isTotal = line.kind === "total";
              const cell = major ? "bg-surface-2" : isTotal ? "border-t border-line" : "";
              // แถวบัญชีกดได้ทั้งแถว: ชี้แล้วทั้งแถวเป็นแถบเม็ดยา ชื่อเป็นสีแบรนด์ + ลูกศร › · คลิกตรงไหนในแถวก็เปิดป๊อปอัป
              // (AccountDetailScope จับคลิกจาก data-account-group บนแถว) · คีย์บอร์ดใช้ปุ่มที่ชื่อรายการ
              const open = clickable && line.kind === "account" && !!line.code;
              const hover = open ? "transition-colors duration-150 group-hover:bg-brand-soft" : "";
              return (
                <tr
                  key={i}
                  {...(open && {
                    "data-account-group": line.code,
                    "data-account-name": line.name,
                    "data-account-value": line.value,
                  })}
                  className={open ? "group cursor-pointer" : undefined}
                >
                  <th
                    scope="row"
                    className={`px-3.5 py-1.5 text-left ${cell} ${hover} ${open ? "rounded-l-full" : ""} ${major ? "rounded-l-full font-semibold text-navy" : isTotal ? "font-medium" : "font-normal text-ink-2"} ${line.kind === "account" && line.indent ? "pl-7" : ""}`}
                  >
                    {open ? (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`${line.name} — ดูบัญชีย่อย`}
                        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full text-left transition-colors duration-150 group-hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                      >
                        <span className="min-w-0">{line.name}</span>
                        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-brand">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    ) : (
                      line.name
                    )}
                  </th>
                  <td className={`num px-2 py-1.5 text-right whitespace-nowrap sm:px-3 ${cell} ${hover} ${major ? "font-semibold" : ""} ${line.value < 0 && isTotal ? "text-loss-text" : ""}`}>
                    <Money value={line.value} />
                  </td>
                  <td className={`num py-1.5 pr-3.5 pl-2 text-right whitespace-nowrap text-ink-3 sm:pl-3.5 ${cell} ${hover} ${major || open ? "rounded-r-full" : ""}`}>{formatPct(line.pctOfRevenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
