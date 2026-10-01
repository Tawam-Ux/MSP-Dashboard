import Link from "next/link";
import { BahtBar, type Segment } from "@/components/baht-bar";
import { PeriodSelect } from "@/components/period-select";
import { StatementTable } from "@/components/statement-table";
import { UnitRanking, type SortKey } from "@/components/unit-ranking";
import { hasPermission } from "@/lib/authz/scope";
import { formatMillions, formatPct, formatPeriod } from "@/lib/format";
import { getChildren, getStatement, getUnitPath, listPeriods } from "@/lib/reports";
import { requirePermission } from "@/lib/session";

const SORT_KEYS: SortKey[] = ["loss", "profit", "order"];

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  if (!user.defaultUnit) {
    return <Empty title="บัญชีนี้ยังไม่ได้รับสิทธิ์ดูหน่วยใด">ติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยที่ต้องการดู</Empty>;
  }
  const periods = await listPeriods(user);
  if (periods.length === 0) {
    return (
      <Empty title="ยังไม่มีข้อมูลงบกำไรขาดทุน">
        {hasPermission(user, "data.upload") ? (
          <Link href="/upload" className="underline">นำเข้าไฟล์ Excel ของเดือนแรก</Link>
        ) : (
          "รอฝ่ายบัญชีนำเข้าข้อมูล"
        )}
      </Empty>
    );
  }

  const period = periods.includes(param("period") ?? "") ? param("period")! : periods[0];
  const unitParam = param("unit");
  const unit = unitParam && user.allowedUnits.has(unitParam) ? unitParam : user.defaultUnit;
  const sort = SORT_KEYS.includes(param("sort") as SortKey) ? (param("sort") as SortKey) : "loss";

  const [path, statement, children] = await Promise.all([
    getUnitPath(user, unit),
    getStatement(user, period, unit),
    getChildren(user, period, unit),
  ]);

  const href = (next: Record<string, string>) => `/?${new URLSearchParams({ period, unit, sort, ...next })}`;
  const current = path[path.length - 1];
  const { totals, lines } = statement;
  const account = (code: string) => lines.find((l) => l.kind === "account" && l.code === code);
  const finance = ["ZZ", "ZZZ"].reduce((s, c) => s + ((account(c) as { value: number } | undefined)?.value ?? 0), 0);

  const segments: Segment[] = [
    { key: "cost", label: "ต้นทุนขาย", amount: totals.TOTAL_COST, color: "var(--seg-cogs)" },
    { key: "selling", label: "ค่าใช้จ่ายขาย", amount: totals.SELLING, color: "var(--seg-selling)" },
    { key: "admin", label: "ค่าใช้จ่ายบริหาร", amount: totals.ADMIN, color: "var(--seg-admin)" },
    { key: "finance", label: "ค่าเสื่อมและดอกเบี้ย", amount: finance, color: "var(--seg-finance)" },
    { key: "profit", label: totals.PBT < 0 ? "ขาดทุนก่อนภาษี" : "กำไรก่อนภาษี", amount: totals.PBT, color: "var(--seg-profit)" },
  ];

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="ลำดับหน่วย" className="text-sm text-ink-2">
            <ol className="flex flex-wrap items-center gap-1">
              {path.map((p, i) => (
                <li key={p.code} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden className="text-ink-3">/</span>}
                  {i < path.length - 1 ? (
                    <Link href={href({ unit: p.code })} className="hover:text-ink hover:underline">{p.name}</Link>
                  ) : (
                    <span aria-current="page" className="text-ink">{p.name}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <PeriodSelect periods={periods} value={period} />
        </div>

        <h1 className="mt-6 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight font-semibold text-balance">
          <Headline name={current.name} period={period} revenue={totals.REV} pbt={totals.PBT} cost={totals.TOTAL_COST + totals.SGA + finance} />
        </h1>

        {totals.REV > 0 ? (
          <>
            <p className="mt-6 text-ink-2">จากรายได้ทุก 100 บาท</p>
            <BahtBar revenue={totals.REV} segments={segments} />
          </>
        ) : (
          <p className="mt-4 text-ink-2">หน่วยนี้ไม่มีรายได้ในงวดนี้ จึงไม่แสดงสัดส่วนต่อรายได้</p>
        )}

        <dl className="mt-10 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-3 lg:grid-cols-5">
          <Figure label="รายได้รวม" value={totals.REV} />
          <Figure label="กำไรขั้นต้น" value={totals.GP} pct={totals.REV ? (totals.GP / totals.REV) * 100 : null} />
          <Figure label="ค่าใช้จ่ายขายและบริหาร" value={totals.SGA} pct={totals.REV ? (totals.SGA / totals.REV) * 100 : null} />
          <Figure label="กำไรจากการดำเนินงาน" value={totals.OP} pct={totals.REV ? (totals.OP / totals.REV) * 100 : null} />
          <Figure label="กำไรก่อนภาษี" value={totals.PBT} pct={totals.REV ? (totals.PBT / totals.REV) * 100 : null} />
        </dl>
      </section>

      <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
        {children.length > 0 ? (
          <UnitRanking
            rows={children}
            sort={sort}
            hrefFor={(code) => href({ unit: code })}
            sortHref={(s) => href({ sort: s })}
          />
        ) : (
          <section className="text-ink-2">
            <h2 className="font-display text-xl font-semibold text-ink">หน่วยล่างสุด</h2>
            <p className="mt-2">{current.name} ไม่มีสาขาย่อย ดูรายละเอียดได้จากงบกำไรขาดทุน</p>
          </section>
        )}
        <StatementTable statement={statement} />
      </div>
    </div>
  );
}

function Headline({ name, period, revenue, pbt, cost }: { name: string; period: string; revenue: number; pbt: number; cost: number }) {
  const when = `${name} ${formatPeriod(period)}`;
  if (revenue === 0) return <>{when} มีค่าใช้จ่าย {formatMillions(cost)} ล้านบาท</>;
  if (pbt < 0) return <>{when} ขายได้ {formatMillions(revenue)} ล้านบาท แต่ขาดทุนก่อนภาษี {formatMillions(-pbt)} ล้านบาท</>;
  return <>{when} ขายได้ {formatMillions(revenue)} ล้านบาท เหลือเป็นกำไรก่อนภาษี {formatMillions(pbt)} ล้านบาท</>;
}

function Figure({ label, value, pct }: { label: string; value: number; pct?: number | null }) {
  return (
    <div className="pr-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1">
        <span className={`text-2xl font-medium ${value < 0 ? "text-loss-text" : ""}`}>{formatMillions(value)}</span>
        <span className="ml-1 text-sm text-ink-3">ล้าน</span>
        {pct !== undefined && <span className="num ml-2 text-sm text-ink-2">{formatPct(pct)}</span>}
      </dd>
    </div>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-lg py-16">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-2">{children}</p>
    </section>
  );
}
