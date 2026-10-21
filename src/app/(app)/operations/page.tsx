import Link from "next/link";
import { Suspense } from "react";
import { OperationsSkeleton, paramsKey } from "@/frontend/components/skeleton";
import { Empty, Kpi, NoData, pickPeriods, readParam } from "@/frontend/components/dash";
import { Icon } from "@/frontend/components/icons";
import { TimelineKpi, loadKpiTimelines } from "@/frontend/components/kpi-timeline";
import { RouteLine } from "@/frontend/components/route-line";
import { PageHeader } from "@/frontend/components/page-header";
import { PeriodSelect } from "@/frontend/components/period-select";
import { UnitDetail } from "@/frontend/components/unit-detail";
import { MarginTrends } from "./margin-trends";
import { ProfitBridge } from "./profit-bridge";
import { TopExpenses } from "./top-expenses";
import { classifyUnits, expenseAccounts, financeCost, ratioOf, sameMonthLastYear } from "@/backend/lib/analysis";
import { Money, MoneyToggle, MoneyUnit } from "@/frontend/components/money";
import { formatPct, formatPeriods, shiftPeriod } from "@/backend/lib/format";
import { getStatements, listPeriods, listUnits, monthlyTotals, treeYearOf, type UnitNode } from "@/backend/lib/reports";
import { requirePermission } from "@/backend/lib/session";
import type { Statement } from "@/backend/lib/statement";

type Op = UnitNode & { s: Statement };

// เกณฑ์แจ้งเตือนใน Watch List
const LOW_GP_MARGIN = 10;
const HIGH_SGA_RATIO = 20;

type SearchParams = Awaited<PageProps<"/operations">["searchParams"]>;

export default async function OperationsPage({ searchParams }: PageProps<"/operations">) {
  const sp = await searchParams;
  // เปลี่ยนงวด → แสดง skeleton ระหว่างโหลด; คลิกดูหน่วย (unit) ไม่ต้อง เพราะต้องเลื่อนไปที่ #anchor
  return (
    <Suspense key={paramsKey(sp, ["unit"])} fallback={<OperationsSkeleton />}>
      <OperationsContent sp={sp} />
    </Suspense>
  );
}

async function OperationsContent({ sp }: { sp: SearchParams }) {
  const user = await requirePermission("dashboard.view");
  const periods = await listPeriods(user);
  if (periods.length === 0 || !user.defaultUnit) return <NoData user={user} />;
  // งวดเดียวหรือหลายเดือนรวมกัน (?period=a,b หรือ all)
  const pick = pickPeriods(periods, readParam(sp, "period"));
  const period = pick.param;
  const periodLabel = formatPeriods(pick.list, pick.all);

  // งวดเปรียบเทียบของสะพานกำไร: เดือนเดียว = เดือนก่อนหน้า · หลายเดือน = เดือนชุดเดียวกันของปีก่อน · ใช้เฉพาะเดือนที่มีข้อมูล
  const baseWanted = pick.multi ? pick.list.map(sameMonthLastYear) : [shiftPeriod(pick.last, -1)];
  const baseList = baseWanted.filter((p) => periods.includes(p));

  // หน่วยที่มีงบในงวดที่เลือกหรืองวดเปรียบเทียบ (สะพานกำไรต้องเห็นหน่วยที่ปิดไปแล้วด้วย) — ผังของปีมีหน่วยที่ไม่มีข้อมูลในงวดนี้
  const { operations } = classifyUnits(await listUnits(user, treeYearOf(pick.sel), [...pick.list, ...baseList]));
  if (operations.length === 0) {
    return <Empty title="ไม่มีหน่วยปฏิบัติการในสิทธิ์ของบัญชีนี้">หน้านี้แสดงสำนักงานใหญ่ ขนส่ง และโรงงาน ที่ไม่ได้อยู่ในโซนขาย</Empty>;
  }
  // แนวโน้ม: 12 เดือนปฏิทินที่จบที่เดือนล่าสุดที่เลือก (เดือนที่ไม่มีข้อมูลเป็นช่องว่างในกราฟ)
  const trendWindow = Array.from({ length: 12 }, (_, i) => shiftPeriod(pick.last, i - 11));

  const opCodes = operations.map((o) => o.code);
  const [statements, baseStatements, monthly] = await Promise.all([
    getStatements(user, pick.sel, [user.defaultUnit, ...opCodes]),
    baseList.length ? getStatements(user, baseList.length === 1 ? baseList[0] : baseList, opCodes) : null,
    monthlyTotals(user, opCodes),
  ]);
  const company = statements.get(user.defaultUnit)!;
  // ทั้งหน้านับเฉพาะหน่วยที่มีงบในงวดที่เลือก (ไม่มีงบ ≠ ศูนย์ต้นทุน) · bridgeUnits รวมหน่วยที่มีเฉพาะในงวดเปรียบเทียบ
  const bridgeUnits: Op[] = operations.map((o) => ({ ...o, s: statements.get(o.code)! }));
  const ops = bridgeUnits.filter((o) => o.s.lines.length > 0);
  const profitCenters = ops.filter((o) => o.s.totals.REV > 0);
  const costCenters = ops.filter((o) => o.s.totals.REV === 0);

  const sum = (f: (s: Statement) => number) => ops.reduce((t, o) => t + f(o.s), 0);
  const revenue = sum((s) => s.totals.REV);
  const spend = sum((s) => s.totals.TOTAL_COST + s.totals.SGA + financeCost(s));
  const op = sum((s) => s.totals.OP);
  const losing = ops.filter((o) => o.s.totals.PBT < 0);
  // หน่วยที่คลิกดูรายละเอียด — แสดงในหน้านี้ ไม่พาไปหน้าอื่น
  const selected = ops.find((o) => o.code === readParam(sp, "unit"));
  const pageHref = (unit?: string) => `/operations?${new URLSearchParams(unit ? { period, unit } : { period })}`;
  // เปิดดูหน่วย = หน้ารายละเอียดของหน่วยนั้น ไม่ต้องเลื่อนไปที่ anchor (ส่วนอื่นของหน้าถูกซ่อนทั้งหมด)
  const unitHref = (code: string) => pageHref(code);

  // รวมบัญชีค่าใช้จ่ายของทุกหน่วยปฏิบัติการ
  const allExpenses = new Map<string, { name: string; value: number }>();
  for (const o of ops) for (const e of expenseAccounts(o.s)) {
    const cur = allExpenses.get(e.code);
    allExpenses.set(e.code, { name: e.name, value: (cur?.value ?? 0) + e.value });
  }
  const expenseList = [...allExpenses.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.value - a.value);

  const actions = (
    <>
      <PeriodSelect periods={periods} value={pick.list} all={pick.all} />
      <MoneyToggle />
    </>
  );
  const route = (
    <RouteLine
      label="ตำแหน่งในหน่วยปฏิบัติการ"
      stops={[
        { label: "Operations", sub: `${ops.length} หน่วย`, href: selected ? pageHref() : undefined, instant: true, state: selected ? ("past" as const) : ("now" as const) },
        selected
          ? { label: selected.name, sub: "ดูงบด้านล่าง", state: "now" as const }
          : { label: "หน่วย", sub: "คลิกชื่อหน่วยเพื่อดูงบ", state: "next" as const },
      ]}
    />
  );

  // ดูรายละเอียดหน่วย: ซ่อน KPI อันดับ และตารางทั้งหมด — เหลือหัวหน้า แถบตำแหน่ง (กดกลับได้) และการ์ดของหน่วย
  if (selected) {
    return (
      <div className="space-y-4">
        <PageHeader title="Operations" caption={`${periodLabel} · รายละเอียดหน่วยปฏิบัติการ`} actions={actions} />
        {route}
        <UnitDetail title="รายละเอียดหน่วยปฏิบัติการ" name={selected.name} statement={selected.s} closeHref={pageHref()} source={{ unit: selected.code, periods: pick.list, periodLabel }} />
      </div>
    );
  }

  // Timeline รายเดือนของการ์ดยอดเงิน (เลือกทั้งปี/ทุกเดือนที่มี): รวมหน่วยชุดเดียวกับการ์ด
  const timelines = await loadKpiTimelines(user, pick, periods, ops.map((o) => o.code));

  return (
    <div className="space-y-4">
      <PageHeader title="Operations" caption={`${periodLabel} · สำนักงานใหญ่ ขนส่ง และโรงงาน ${ops.length} หน่วย`} actions={actions} />

      {route}

      <section aria-label="ตัวเลขหลัก" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <TimelineKpi timelines={timelines} metric="REV" label="รายได้หน่วยปฏิบัติการ" value={revenue} line="rev" code="REV" note={`${formatPct(ratioOf(revenue, company.totals.REV))} ของรายได้ทั้งบริษัท`} />
        <TimelineKpi timelines={timelines} metric="EXP" label="ต้นทุนและค่าใช้จ่ายรวม" value={spend} line="ink" code="EXP" note={`รวมหน่วยที่ไม่มีรายได้ ${costCenters.length} หน่วย`} />
        <TimelineKpi timelines={timelines} metric="OP" label="กำไรจากการดำเนินงาน" value={op} line="op" code="OP" note={`OP Margin ${formatPct(ratioOf(op, revenue))}`} />
        <Kpi
          label="หน่วยขาดทุน"
          value={losing.length}
          unit={`จาก ${ops.length} หน่วย`}
          line="msp"
          code="LOSS"
          note={losing.length ? <>ขาดทุนรวม <Money value={losing.reduce((t, o) => t + o.s.totals.PBT, 0)} unit="short" /></> : "ทุกหน่วยมีกำไร"}
        />
      </section>

      {/* ไม่มีศูนย์ต้นทุน = การ์ดค่าใช้จ่ายส่วนกลางว่างทั้งใบ จึงไม่แสดง และให้ตารางเต็มความกว้าง */}
      {/* คู่กับการ์ดค่าใช้จ่ายส่วนกลางเมื่อจอกว้างพอให้ตารางเต็ม (xl) — จอเล็กกว่านั้นเรียงลง ตารางได้เต็มความกว้าง */}
      <div className={`grid gap-4 ${costCenters.length > 0 ? "xl:grid-cols-[1.5fr_1fr]" : ""}`}>
        <UnitPerformance ops={ops} hrefFor={unitHref} />
        {costCenters.length > 0 && <CentralCost costCenters={costCenters} companyRevenue={company.totals.REV} hrefFor={unitHref} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ProfitBridge
          units={baseStatements && bridgeUnits.map((o) => ({ code: o.code, name: o.name, now: o.s, before: baseStatements.get(o.code)! }))}
          periodLabel={formatPeriods(pick.list, pick.all)}
          baseLabel={formatPeriods(baseWanted)}
          baseNote={baseList.length > 0 && baseList.length < baseWanted.length ? `มีข้อมูลเปรียบเทียบ ${baseList.length} จาก ${baseWanted.length} เดือน` : undefined}
          hrefFor={unitHref}
        />
        <TopExpenses list={expenseList} />
      </div>

      <MarginTrends
        units={profitCenters.map((o) => ({
          code: o.code,
          name: o.name,
          href: unitHref(o.code),
          points: trendWindow.map((p) => {
            const t = monthly.get(p)?.get(o.code);
            return { period: p, gp: t ? ratioOf(t.GP, t.REV) : null, pbt: t ? ratioOf(t.PBT, t.REV) : null };
          }),
        }))}
        window={trendWindow}
        selected={pick.list}
      />

      <WatchList ops={ops} hrefFor={unitHref} />
    </div>
  );
}

/** สัดส่วนต่อรายได้ · รายได้น้อยมากจน % เกิน ±999 = ไม่มีความหมายในการเทียบ แสดงเป็นเพดาน (ค่าจริงอยู่ใน title) */
function Ratio({ value }: { value: number | null }) {
  if (value != null && Math.abs(value) >= 1000) return <span title={formatPct(value)}>{value < 0 ? "<-999%" : ">999%"}</span>;
  return <>{formatPct(value)}</>;
}

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="row-chev inline-block">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * ตารางผลประกอบการ: กลุ่มมีรายได้ (เรียงรายได้มากไปน้อย) แล้วกลุ่มศูนย์ต้นทุน (ไม่มีรายได้ เรียงขาดทุนมากก่อน) — แยกด้วยแถวหัวกลุ่ม
 * การ์ดกว้างพอ (container ≥ 48rem): 6 คอลัมน์ตามลำดับงบ รายได้ · GP% · SG&A · PBT · PBT% — ตัวเงินสีหมึก สัดส่วนสีจาง PBT เด่นสุด
 * การ์ดแคบ: ชื่อหน่วย + บรรทัดย่อย (รายได้ · GP · PBT%) ทางซ้าย PBT ทางขวา — ไม่มีแถบเลื่อนแนวนอน
 * กำไร/ขาดทุนบอกด้วยเครื่องหมายลบ + สี (ไม่ต้องมีป้ายสถานะซ้ำ) · กดได้ทั้งแถว (.row-link)
 */
function UnitPerformance({ ops, hrefFor }: { ops: Op[]; hrefFor: (code: string) => string }) {
  const earning = ops.filter((o) => o.s.totals.REV !== 0).sort((a, b) => b.s.totals.REV - a.s.totals.REV);
  const centers = ops.filter((o) => o.s.totals.REV === 0).sort((a, b) => a.s.totals.PBT - b.s.totals.PBT);
  const wide = "hidden @3xl:table-cell";

  const row = (o: Op) => {
    const t = o.s.totals;
    const gp = ratioOf(t.GP, t.REV);
    const pbtPct = ratioOf(t.PBT, t.REV);
    return (
      <tr key={o.code} className="row-link">
        <th scope="row" className="text-left! font-normal">
          <Link href={hrefFor(o.code)} className="row-link-a font-semibold whitespace-nowrap">{o.name}</Link>
          {/* การ์ดแคบ: ตัวเลขรองย้ายมาอยู่ใต้ชื่อ */}
          <span className="num mt-0.5 block text-xs text-ink-3 @3xl:hidden">
            {t.REV === 0 ? (
              <>SG&A <Money value={t.SGA} /></>
            ) : (
              <>
                <span className="whitespace-nowrap">รายได้ <Money value={t.REV} /></span>
                {" · "}
                <span className="whitespace-nowrap">GP <Ratio value={gp} /> · PBT <Ratio value={pbtPct} /></span>
              </>
            )}
          </span>
        </th>
        <td className={`num text-right ${wide}`}><Money value={t.REV} /></td>
        <td className={`num text-right text-ink-2 ${wide}`}><Ratio value={gp} /></td>
        <td className={`num text-right ${wide}`}><Money value={t.SGA} /></td>
        <td className={`num pl-1! text-right font-semibold @3xl:pl-3.5! ${t.PBT < 0 ? "text-loss-text" : "text-good"}`}><Money value={t.PBT} /></td>
        <td className={`num text-right text-ink-2 ${wide}`}><Ratio value={pbtPct} /></td>
        <td className="pl-0! text-right"><Chevron /></td>
      </tr>
    );
  };

  return (
    <section className="card card-fixed card-xl @container">
      <h2 className="card-title">Unit Performance</h2>
      <p className="card-cap">
        มีรายได้ {earning.length} หน่วย{centers.length > 0 && ` · ศูนย์ต้นทุน ${centers.length} หน่วย`} (<MoneyUnit long />) · คลิกแถวเพื่อดูงบเต็มของหน่วย
      </p>
      <div className="card-body">
        <table className="tbl">
          <thead>
            <tr>
              <th>หน่วย</th>
              <th className={`text-right! ${wide}`}>รายได้</th>
              <th className={`text-right! ${wide}`}>GP%</th>
              <th className={`text-right! ${wide}`}>SG&A</th>
              <th className="pl-1! text-right! @3xl:pl-3.5!">PBT</th>
              <th className={`text-right! ${wide}`}>PBT%</th>
              <th aria-label="ดูรายละเอียด" className="w-8" />
            </tr>
          </thead>
          <tbody>
            {earning.map(row)}
            {centers.length > 0 && (
              <tr className="row-group">
                <th colSpan={7} scope="rowgroup">
                  ศูนย์ต้นทุน <span className="font-normal text-ink-3">· ไม่มีรายได้ จึงไม่มี GP% และ PBT%</span>
                </th>
              </tr>
            )}
            {centers.map(row)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * ค่าใช้จ่ายของหน่วยที่ไม่มีรายได้ (Cost Center): ยอดรวมบนสุด (แบบเดียวกับการ์ดค่าใช้จ่ายดำเนินงานหลัก)
 * แล้วทีละหน่วย เรียงมากไปน้อย — หัวกลุ่ม: ชื่อหน่วย (กดดูงบ) · ยอด · % ของส่วนกลาง · ใต้หัว: บัญชีหลัก 3 อันดับของหน่วยนั้น
 */
function CentralCost({ costCenters, companyRevenue, hrefFor }: { costCenters: Op[]; companyRevenue: number; hrefFor: (code: string) => string }) {
  const spend = (s: Statement) => s.totals.TOTAL_COST + s.totals.SGA + financeCost(s);
  const units = [...costCenters].sort((a, b) => spend(b.s) - spend(a.s));
  const total = units.reduce((t, o) => t + spend(o.s), 0);

  return (
    <section className="card card-fixed card-xl">
      <h2 className="card-title">ค่าใช้จ่ายส่วนกลาง</h2>
      <p className="card-cap">หน่วยที่ไม่มีรายได้ (Cost Center) ไม่จัดอันดับเป็น Profit Center (<MoneyUnit long />)</p>
      {units.length === 0 ? (
        <p className="text-sm text-ink-3">ไม่มีหน่วยที่เป็นศูนย์ต้นทุน</p>
      ) : (
        <>
          <div className="mb-2 rounded-(--r-inner) bg-surface-2 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] text-ink-2">รวม {units.length} หน่วย</span>
              <span className="num text-lg font-semibold"><Money value={total} /></span>
            </div>
            <p className="num text-right text-xs text-ink-3">{formatPct(ratioOf(total, companyRevenue))} ของรายได้ทั้งบริษัท</p>
          </div>
          <div className="card-body">
            {units.map((o) => {
              const own = spend(o.s);
              return (
                <section key={o.code} className="border-b border-line py-3 last:border-0">
                  <h3 className="flex items-baseline gap-3 text-[0.8125rem]">
                    <Link href={hrefFor(o.code)} className="group min-w-0 flex-1 font-semibold hover:text-brand">
                      <span className="group-hover:underline group-hover:underline-offset-3">{o.name}</span> <Chevron />
                    </Link>
                    <span className="num font-semibold"><Money value={own} /></span>
                    <span className="num w-12 text-right text-xs font-normal text-ink-3">{formatPct(ratioOf(own, total))}</span>
                  </h3>
                  <ul className="mt-1.5 space-y-1 pl-3">
                    {expenseAccounts(o.s).slice(0, 3).map((e) => (
                      <li key={e.code} className="flex items-baseline gap-3 text-xs text-ink-2">
                        <span className="min-w-0 flex-1">{e.name}</span>
                        <span className="num"><Money value={e.value} /></span>
                        <span className="num w-12 text-right text-ink-3">{formatPct(ratioOf(e.value, own))}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * หน่วยที่ควรติดตาม: 1 แถวต่อ 1 หน่วย × 3 เกณฑ์ (ขาดทุน · GP Margin ต่ำ · SG&A สูง) — ชื่อหน่วยไม่ซ้ำ อ่านตามแถวได้ทันทีว่าหลุดเกณฑ์ไหนบ้าง
 * ช่องที่หลุดเกณฑ์เป็นป้ายสี (แดง = ขาดทุน/GP ติดลบ, ส้ม = เฝ้าระวัง) ช่องที่ผ่านเป็นขีดจาง · เรียงขาดทุนมากก่อน
 * การ์ดแคบ: ป้ายย้ายมาอยู่ใต้ชื่อพร้อมชื่อเกณฑ์ · กดได้ทั้งแถว (.row-link)
 */
function WatchList({ ops, hrefFor }: { ops: Op[]; hrefFor: (code: string) => string }) {
  type Flag = { key: "loss" | "gp" | "sga"; label: string; tone: "bad" | "warn"; value: React.ReactNode };
  const rows = [...ops]
    .sort((a, b) => a.s.totals.PBT - b.s.totals.PBT)
    .map((o) => {
      const t = o.s.totals;
      const gpm = ratioOf(t.GP, t.REV);
      const sga = ratioOf(t.SGA, t.REV);
      const flags: Flag[] = [];
      if (t.REV > 0 && t.PBT < 0) flags.push({ key: "loss", label: "ขาดทุน", tone: "bad", value: <Money value={-t.PBT} unit="short" /> });
      if (gpm != null && gpm < LOW_GP_MARGIN) flags.push({ key: "gp", label: "GP", tone: gpm < 0 ? "bad" : "warn", value: <Ratio value={gpm} /> });
      if (sga != null && sga > HIGH_SGA_RATIO) flags.push({ key: "sga", label: "SG&A", tone: "warn", value: <Ratio value={sga} /> });
      return { o, flags };
    })
    .filter((r) => r.flags.length > 0);
  const count = (k: Flag["key"]) => rows.filter((r) => r.flags.some((f) => f.key === k)).length;
  const wide = "hidden @2xl:table-cell";

  const cell = (flags: Flag[], key: Flag["key"]) => {
    const f = flags.find((x) => x.key === key);
    return (
      <td className={`num text-right ${wide}`}>
        {f ? <span className={`badge badge-${f.tone} num`}>{f.value}</span> : <span className="text-ink-3" aria-label="ผ่านเกณฑ์">–</span>}
      </td>
    );
  };

  return (
    <section className="card card-fixed card-xl @container">
      <h2 className="card-title">Watch List</h2>
      <p className="card-cap">
        {rows.length === 0
          ? `เกณฑ์: ขาดทุน · GP Margin ต่ำกว่า ${LOW_GP_MARGIN}% · SG&A เกิน ${HIGH_SGA_RATIO}% ของรายได้`
          : `${rows.length} หน่วยหลุดเกณฑ์ · ขาดทุน ${count("loss")} · GP ต่ำ ${count("gp")} · SG&A สูง ${count("sga")} · เรียงขาดทุนมากก่อน คลิกแถวเพื่อดูงบ`}
      </p>
      {rows.length === 0 ? (
        <p className="panel panel-good flex items-center gap-2 text-sm text-good"><Icon name="check" size={14} stroke={3} />ไม่มีหน่วยที่เข้าเกณฑ์ต้องติดตาม</p>
      ) : (
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr>
                {/* คอลัมน์ชื่อรับพื้นที่ที่เหลือ — ป้าย 3 เกณฑ์อยู่ชิดกันทางขวา ไล่สายตาตามแถวได้สั้น */}
                <th className="w-full">หน่วย</th>
                <th className={`text-right! ${wide}`}>ขาดทุน (PBT)</th>
                <th className={`text-right! ${wide}`}>GP Margin <span className="text-ink-3">&lt; {LOW_GP_MARGIN}%</span></th>
                <th className={`text-right! ${wide}`}>SG&A/รายได้ <span className="text-ink-3">&gt; {HIGH_SGA_RATIO}%</span></th>
                <th aria-label="ดูรายละเอียด" className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, flags }) => (
                <tr key={o.code} className="row-link">
                  <th scope="row" className="text-left! font-normal">
                    {/* จุดสีเป็น inline ไม่ใช้ flex ครอบลิงก์ — flex item วาดแบบ atomic ทำให้ ::after ของลิงก์จมใต้ช่องอื่น กดแถวไม่ติด */}
                    <span className={`mr-2.5 mb-0.5 inline-block size-2 rounded-full align-middle ${flags.some((f) => f.tone === "bad") ? "bg-loss" : "bg-warn"}`} aria-hidden />
                    <Link href={hrefFor(o.code)} className="row-link-a font-semibold whitespace-nowrap">{o.name}</Link>
                    {/* การ์ดแคบ: ป้ายพร้อมชื่อเกณฑ์อยู่ใต้ชื่อ */}
                    <span className="mt-1.5 flex flex-wrap gap-1.5 pl-4.5 @2xl:hidden">
                      {flags.map((f) => (
                        <span key={f.key} className={`badge badge-${f.tone} num`}>{f.label} {f.value}</span>
                      ))}
                    </span>
                  </th>
                  {cell(flags, "loss")}
                  {cell(flags, "gp")}
                  {cell(flags, "sga")}
                  <td className="pl-0! text-right"><Chevron /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
