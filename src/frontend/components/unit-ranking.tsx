import Link from "next/link";
import { formatPct } from "@/backend/lib/format";
import { Icon } from "./icons";
import { Money, MoneyUnit } from "./money";
import type { ChildSummary } from "@/backend/lib/reports";

export type SortKey = "loss" | "profit" | "order";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "loss", label: "ขาดทุนมากสุด" },
  { key: "profit", label: "กำไรมากสุด" },
  { key: "order", label: "ตามลำดับหน่วย" },
];

/** ปุ่มกลับไปหน่วยแม่ */
export function BackLink({ href, name }: { href: string; name: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="btn-soft mb-3 self-start font-semibold text-ink!"
    >
      <Icon name="back" size={14} stroke={2.4} /> ย้อนกลับไป {name}
    </Link>
  );
}

export function UnitRanking({
  rows, sort, hrefFor, sortHref, back,
}: {
  rows: ChildSummary[];
  sort: SortKey;
  hrefFor: (code: string) => string;
  sortHref: (sort: SortKey) => string;
  back?: { href: string; name: string } | null;
}) {
  const sorted = [...rows];
  if (sort === "loss") sorted.sort((a, b) => a.statement.totals.PBT - b.statement.totals.PBT);
  if (sort === "profit") sorted.sort((a, b) => b.statement.totals.PBT - a.statement.totals.PBT);

  const margin = (r: ChildSummary) => (r.statement.totals.REV === 0 ? null : (r.statement.totals.PBT / r.statement.totals.REV) * 100);
  const lossCount = rows.filter((r) => r.statement.totals.PBT < 0).length;

  return (
    <section aria-labelledby="units-heading" className="card card-fixed card-xl">
      {back && <BackLink href={back.href} name={back.name} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="units-heading" className="card-title">จัดอันดับหน่วย</h2>
          <p className="card-cap mb-0">
            คลิกชื่อหน่วยเพื่อดริลลงไประดับถัดไป ·{" "}
            {lossCount === 0 ? <span className="text-good">ทุกหน่วยมีกำไร</span> : <span className="text-loss-text">ขาดทุน {lossCount} หน่วย</span>}
          </p>
        </div>
        <nav className="seg" aria-label="เรียงลำดับ">
          {SORTS.map((s) => (
            <Link key={s.key} href={sortHref(s.key)} scroll={false} aria-current={sort === s.key ? "true" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="card-body mt-3.5">
        <table className="tbl">
          <caption className="sr-only">รายได้และกำไรก่อนภาษีของแต่ละหน่วย หน่วย <MoneyUnit long /></caption>
          <thead>
            <tr>
              <th scope="col">หน่วย</th>
              <th scope="col" className="text-right!">รายได้ (<MoneyUnit />)</th>
              <th scope="col" className="text-right!">PBT (<MoneyUnit />)</th>
              <th scope="col" className="text-right!">PBT %</th>
              <th scope="col">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const m = margin(r);
              const pbt = r.statement.totals.PBT;
              const noRev = r.statement.totals.REV === 0;
              return (
                <tr key={r.code} className="group">
                  <th scope="row" className="text-left font-normal">
                    <Link href={hrefFor(r.code)} className="inline-flex items-center gap-2.5 font-semibold text-ink group-hover:text-brand group-hover:underline">
                      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${noRev ? "bg-(--route-off)" : pbt < 0 ? "bg-loss" : "bg-(--line-gp)"}`} />
                      {r.name}
                    </Link>
                    {r.hasChildren && <span className="badge badge-muted ml-2">มีสาขาย่อย</span>}
                  </th>
                  <td className="num text-right"><Money value={r.statement.totals.REV} /></td>
                  <td className={`num text-right font-semibold ${pbt < 0 ? "text-loss-text" : "text-good"}`}><Money value={pbt} /></td>
                  <td className={`num text-right ${m == null || noRev ? "text-ink-3" : m < 0 ? "text-loss-text" : "text-ink-2"}`}>
                    {noRev ? "—" : formatPct(m)}
                  </td>
                  <td>
                    {noRev ? (
                      <span className="badge badge-muted">ศูนย์ต้นทุน</span>
                    ) : (
                      <span className={`badge ${pbt < 0 ? "badge-bad" : "badge-good"}`}>{pbt < 0 ? "ขาดทุน" : "กำไร"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
