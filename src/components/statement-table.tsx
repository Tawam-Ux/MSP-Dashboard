import { formatBaht, formatPct } from "@/lib/format";
import type { ComputedLine, Statement } from "@/lib/statement";

/** ซ่อนบัญชีที่เป็น 0 และหัวข้อที่ไม่มีบัญชีเหลือ แต่คงยอดรวมไว้เสมอ */
function visibleLines(lines: ComputedLine[]): ComputedLine[] {
  const out: ComputedLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.kind === "account" && line.value === 0) continue;
    if (line.kind === "heading") {
      let j = i + 1;
      let hasContent = false;
      while (j < lines.length && lines[j].kind !== "heading") {
        const next = lines[j];
        if (next.kind === "total" || (next.kind === "account" && next.value !== 0)) hasContent = true;
        j++;
      }
      if (!hasContent) continue;
    }
    out.push(line);
  }
  return out;
}

export function StatementTable({ statement }: { statement: Statement }) {
  return (
    <section aria-labelledby="statement-heading">
      <h2 id="statement-heading" className="font-display text-xl font-semibold">
        งบกำไรขาดทุน
      </h2>
      <p className="mt-1 text-sm text-ink-2">หน่วยบาท ซ่อนรายการที่เป็นศูนย์</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th scope="col" className="py-2 font-normal">รายการ</th>
            <th scope="col" className="py-2 text-right font-normal">บาท</th>
            <th scope="col" className="w-16 py-2 text-right font-normal">% รายได้</th>
          </tr>
        </thead>
        <tbody>
          {visibleLines(statement.lines).map((line, i) => {
            if (line.kind === "heading") {
              return (
                <tr key={i}>
                  <th colSpan={3} scope="colgroup" className="pt-4 pb-1 text-left font-medium text-ink-2">
                    {line.name}
                  </th>
                </tr>
              );
            }
            const major = line.kind === "total" && line.emphasis === "major";
            const isTotal = line.kind === "total";
            return (
              <tr key={i} className={major ? "border-t border-line-strong" : isTotal ? "border-t border-line" : ""}>
                <th
                  scope="row"
                  className={`py-1.5 pr-2 text-left ${major ? "font-semibold" : isTotal ? "font-medium" : "font-normal"} ${line.kind === "account" && line.indent ? "pl-4" : ""}`}
                >
                  {line.name}
                </th>
                <td className={`num py-1.5 text-right ${major ? "font-semibold" : ""} ${line.value < 0 && isTotal ? "text-loss-text" : ""}`}>
                  {formatBaht(line.value)}
                </td>
                <td className="num py-1.5 text-right text-ink-3">{formatPct(line.pctOfRevenue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
