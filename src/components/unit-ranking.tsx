import Link from "next/link";
import { formatMillions, formatPct } from "@/lib/format";
import type { ChildSummary } from "@/lib/reports";

export type SortKey = "loss" | "profit" | "order";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "loss", label: "กำไรน้อยก่อน" },
  { key: "profit", label: "กำไรมากก่อน" },
  { key: "order", label: "ตามผังองค์กร" },
];

export function UnitRanking({
  rows, sort, hrefFor, sortHref,
}: {
  rows: ChildSummary[];
  sort: SortKey;
  hrefFor: (code: string) => string;
  sortHref: (sort: SortKey) => string;
}) {
  const sorted = [...rows];
  if (sort === "loss") sorted.sort((a, b) => a.statement.totals.PBT - b.statement.totals.PBT);
  if (sort === "profit") sorted.sort((a, b) => b.statement.totals.PBT - a.statement.totals.PBT);

  const margin = (r: ChildSummary) => (r.statement.totals.REV === 0 ? null : (r.statement.totals.PBT / r.statement.totals.REV) * 100);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(margin(r) ?? 0)));
  const lossCount = rows.filter((r) => r.statement.totals.PBT < 0).length;

  return (
    <section aria-labelledby="units-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="units-heading" className="font-display text-xl font-semibold">
          {rows.length} หน่วยภายใต้หน่วยนี้
        </h2>
        <p className="text-sm text-ink-2">
          {lossCount === 0 ? "ทุกหน่วยมีกำไร" : `ขาดทุน ${lossCount} หน่วย`}
        </p>
      </div>
      <nav className="mt-3 flex gap-1 text-sm" aria-label="เรียงลำดับ">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={sortHref(s.key)}
            scroll={false}
            aria-current={sort === s.key ? "true" : undefined}
            className={`rounded-md px-2.5 py-1 ${sort === s.key ? "bg-surface font-medium shadow-[inset_0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">รายได้และกำไรก่อนภาษีของแต่ละหน่วย หน่วยล้านบาท</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th scope="col" className="py-2 font-normal">หน่วย</th>
            <th scope="col" className="py-2 text-right font-normal">รายได้ (ล้าน)</th>
            <th scope="col" className="py-2 text-right font-normal">กำไรก่อนภาษี (ล้าน)</th>
            <th scope="col" className="hidden w-[32%] py-2 pl-6 font-normal sm:table-cell">อัตรากำไรก่อนภาษี</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const m = margin(r);
            const pbt = r.statement.totals.PBT;
            return (
              <tr key={r.code} className="group border-b border-line last:border-0 hover:bg-surface">
                <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                  <Link href={hrefFor(r.code)} className="font-medium group-hover:underline">
                    {r.name}
                  </Link>
                  {r.hasChildren && <span className="ml-2 text-xs text-ink-3">มีสาขาย่อย</span>}
                </th>
                <td className="num py-2.5 text-right">{formatMillions(r.statement.totals.REV)}</td>
                <td className={`num py-2.5 text-right font-medium ${pbt < 0 ? "text-loss-text" : ""}`}>{formatMillions(pbt)}</td>
                <td className="hidden py-2.5 pl-6 sm:table-cell">
                  {m == null ? (
                    <span className="text-xs text-ink-3">ไม่มีรายได้</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative h-3 flex-1" aria-hidden>
                        <div className="absolute inset-y-[-3px] left-1/2 border-l border-line-strong" />
                        <div
                          className={`absolute inset-y-0 ${m < 0 ? "right-1/2 rounded-l bg-loss" : "left-1/2 rounded-r bg-gain"}`}
                          style={{ width: `${(Math.abs(m) / maxAbs) * 50}%` }}
                        />
                      </div>
                      <span className={`num w-14 text-right ${m < 0 ? "text-loss-text" : "text-ink-2"}`}>{formatPct(m)}</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
