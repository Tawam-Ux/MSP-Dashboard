import { Suspense } from "react";
import { PnlSkeleton, paramsKey } from "@/frontend/components/skeleton";
import { Delta, Empty, MoneyKpi, NoData, PanelTitle, RankBar, Ratio, RatioStrip, SegLinks, pickPeriods, readParam } from "@/frontend/components/dash";
import { RouteLine } from "@/frontend/components/route-line";
import { PageHeader } from "@/frontend/components/page-header";
import { PeriodSelect } from "@/frontend/components/period-select";
import { TrendChart } from "@/frontend/components/trend-chart";
import { UnitSelect } from "@/frontend/components/unit-select";
import { changePct, expenseAccounts, financeCost, ratioOf, sameMonthLastYear } from "@/backend/lib/analysis";
import { Money, MoneyToggle, MoneyUnit } from "@/frontend/components/money";
import { formatBaht, formatPct, formatPeriod, formatPeriods, shiftPeriod } from "@/backend/lib/format";
import { getHistory, getUnitPath, listPeriods, listUnits, treeYearOf } from "@/backend/lib/reports";
import { requirePermission } from "@/backend/lib/session";
import { emptyStatement, sumStatements, type Statement, type TotalKey } from "@/backend/lib/statement";

type Mode = "mom" | "yoy" | "ytd";
const MODES: { key: Mode; label: string }[] = [
  { key: "mom", label: "รายเดือน · เทียบงวดก่อน" },
  { key: "yoy", label: "รายเดือน · เทียบปีก่อน" },
  { key: "ytd", label: "สะสม YTD · เทียบปีก่อน" },
];

type Metric = "REV" | "GP" | "OP" | "PBT" | "GPM";
const METRICS: { key: Metric; label: string }[] = [
  { key: "REV", label: "Revenue" },
  { key: "GP", label: "GP" },
  { key: "OP", label: "OP" },
  { key: "PBT", label: "PBT" },
  { key: "GPM", label: "GP Margin" },
];
// สีเส้นกราฟตามสายของตัวชี้วัด (ตรงกับป้ายวงกลมของ KPI)
const METRIC_LINE: Record<Metric, string> = { REV: "var(--line-rev)", GP: "var(--line-gp)", OP: "var(--line-op)", PBT: "var(--line-pbt)", GPM: "var(--line-gp)" };

/** จำนวนเดือนจาก a ถึง b ("2026-01-01" → "2026-03-01" = 2) */
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

type SearchParams = Awaited<PageProps<"/pnl">["searchParams"]>;

export default async function PnlPage({ searchParams }: PageProps<"/pnl">) {
  const sp = await searchParams;
  // เปลี่ยนงวด/หน่วย/โหมด → แสดง skeleton ระหว่างโหลด; สลับเส้นกราฟ (metric) ไม่ต้อง หน้าจะได้ไม่กระโดด
  return (
    <Suspense key={paramsKey(sp, ["metric"])} fallback={<PnlSkeleton />}>
      <PnlContent sp={sp} />
    </Suspense>
  );
}

async function PnlContent({ sp }: { sp: SearchParams }) {
  const user = await requirePermission("dashboard.view");
  const periods = await listPeriods(user);
  if (periods.length === 0 || !user.defaultUnit) return <NoData user={user} />;

  // งวดเดียวหรือหลายเดือนรวมกัน (?period=a,b หรือ all) · YTD ใช้งวดล่าสุดในชุดที่เลือกเป็นจุดสิ้นสุด
  const pick = pickPeriods(periods, readParam(sp, "period"));
  const period = pick.param;
  const lastPeriod = pick.last;
  const unitParam = readParam(sp, "unit");
  const unit = unitParam && user.allowedUnits.has(unitParam) ? unitParam : user.defaultUnit;
  const mode = (MODES.some((m) => m.key === readParam(sp, "mode")) ? readParam(sp, "mode") : "mom") as Mode;
  const metric = (METRICS.some((m) => m.key === readParam(sp, "metric")) ? readParam(sp, "metric") : "REV") as Metric;

  // หน่วยและเส้นทางตามผังของปีเดือนล่าสุดที่เลือก
  const treeYear = treeYearOf(pick.sel);
  // ตัวเลือกหน่วย = หน่วยที่มีงบในงวดที่ดู (YTD = ต้นปีถึงเดือนล่าสุดที่เลือก) — ผังของปีมีหน่วยที่ไม่มีข้อมูลในงวดนี้ด้วย
  const shownPeriods = mode === "ytd" ? periods.filter((p) => p.startsWith(lastPeriod.slice(0, 4)) && p <= lastPeriod) : pick.list;
  const [withData, allUnits, history, path] = await Promise.all([
    listUnits(user, treeYear, shownPeriods), listUnits(user, treeYear), getHistory(user, unit), getUnitPath(user, treeYear, unit),
  ]);
  // คงหน่วยที่กำลังดูไว้ในตัวเลือกเสมอ (แม้ไม่มีข้อมูลในงวดนี้) ไม่ให้ dropdown กระโดดไปหน่วยอื่น
  const units = withData.some((u) => u.code === unit) ? withData : allUnits.filter((u) => u.code === unit || withData.some((w) => w.code === u.code));
  const unitName = allUnits.find((u) => u.code === unit)?.name ?? unit;
  /** เดือนที่หน่วยนี้มีงบ — ตัวเลือกเดือนกดได้เฉพาะเดือนเหล่านี้ */
  const unitPeriods = history.map((h) => h.period);
  const unitHasData = shownPeriods.some((p) => unitPeriods.includes(p));
  const at = (p: string | undefined) => history.find((h) => h.period === p);
  const empty = emptyStatement();

  // งวดปัจจุบันและงวดเปรียบเทียบตามโหมด
  let current: Statement;
  let base: Statement | null;
  let baseLabel: string;
  if (mode === "ytd") {
    const year = lastPeriod.slice(0, 4);
    const lastYearEnd = sameMonthLastYear(lastPeriod);
    const lastYear = String(Number(year) - 1);
    current = sumStatements(history.filter((h) => h.period.startsWith(year) && h.period <= lastPeriod).map((h) => h.statement));
    const prior = history.filter((h) => h.period.startsWith(lastYear) && h.period <= lastYearEnd);
    base = prior.length ? sumStatements(prior.map((h) => h.statement)) : null;
    baseLabel = `YTD ${Number(lastYear) + 543}`;
  } else if (!pick.multi) {
    current = at(lastPeriod)?.statement ?? empty;
    const basePeriod = mode === "yoy" ? sameMonthLastYear(lastPeriod) : periods[periods.indexOf(lastPeriod) + 1];
    base = at(basePeriod)?.statement ?? null;
    baseLabel = basePeriod ? formatPeriod(basePeriod) : "งวดก่อน";
  } else {
    // หลายเดือนรวมกัน: เทียบงวดก่อน = ชุดเดือนเดียวกันเลื่อนถอยไปเท่าช่วงที่เลือก (ม.ค.+ก.พ. → พ.ย.+ธ.ค. ปีก่อน) · เทียบปีก่อน = ชุดเดือนเดียวกันของปีก่อน
    const sumOf = (list: string[]) => {
      const found = list.flatMap((p) => at(p)?.statement ?? []);
      return found.length ? sumStatements(found) : null;
    };
    current = sumOf(pick.list) ?? empty;
    const span = monthsBetween(pick.list[0], lastPeriod) + 1;
    const baseList = pick.list.map((p) => (mode === "yoy" ? sameMonthLastYear(p) : shiftPeriod(p, -span)));
    base = sumOf(baseList);
    baseLabel = formatPeriods(baseList);
  }

  const t = current.totals;
  const b = base?.totals;
  const r = (n: number) => ratioOf(n, t.REV);
  const rb = (key: TotalKey) => (b ? ratioOf(b[key], b.REV) : null);
  const pts = (key: TotalKey) => {
    const now = r(t[key]);
    const before = rb(key);
    return now == null || before == null ? null : now - before;
  };
  const cmpText = base ? `เทียบ ${baseLabel}` : "ไม่มีข้อมูลงวดเปรียบเทียบ";

  const href = (next: Record<string, string>) => `/pnl?${new URLSearchParams({ period, unit, mode, metric, ...next })}`;
  const title = mode === "ytd" ? `สะสมถึง ${formatPeriod(lastPeriod)}` : formatPeriods(pick.list, pick.all);

  // แนวโน้มรายเดือน 12 งวดล่าสุด
  const trend = history.slice(-12).map((h) => ({
    period: h.period,
    value: metric === "GPM" ? ratioOf(h.statement.totals.GP, h.statement.totals.REV) : h.statement.totals[metric],
  }));

  const top = (
    <>
      <PageHeader
        title="P&L Analysis"
        caption={`${unitName} · ${title} · วิเคราะห์รายได้ ต้นทุน ค่าใช้จ่าย และกำไร`}
        actions={
          <>
            <UnitSelect units={units} value={unit} />
            <PeriodSelect periods={periods} value={pick.list} all={pick.all} available={unitPeriods} />
            <MoneyToggle />
          </>
        }
      />

      <RouteLine
        stops={path.map((p, i) => ({
          label: p.name,
          href: i < path.length - 1 ? href({ unit: p.code }) : undefined,
          state: i < path.length - 1 ? ("past" as const) : ("now" as const),
        }))}
      />

      <SegLinks label="โหมดเปรียบเทียบ" items={MODES.map((m) => ({ href: href({ mode: m.key }), label: m.label, active: m.key === mode }))} />
    </>
  );

  // หน่วยนี้ไม่มีงบในงวดที่ดู (เช่น สาขาที่เปิดทีหลัง) — บอกตรงๆ แทนการ์ดที่เป็นศูนย์ทั้งหมด
  if (!unitHasData) {
    return (
      <div className="space-y-4">
        {top}
        <Empty title={`${unitName} ไม่มีข้อมูลในงวด ${title}`}>
          <p>
            {unitPeriods.length
              ? `หน่วยนี้มีข้อมูลเฉพาะ ${formatPeriods(unitPeriods)} — เลือกเดือนเหล่านี้ หรือเลือกหน่วยอื่น`
              : "หน่วยนี้ยังไม่มีข้อมูลในระบบ"}
          </p>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {top}

      <section aria-label="ตัวเลขหลัก" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyKpi label="Revenue" value={t.REV} line="rev" code="REV" note={<><Delta value={changePct(t.REV, b?.REV)} /> {cmpText}</>} />
        {/* Margin แสดงในแถบอัตราส่วนด้านล่างแล้ว หมายเหตุใต้ตัวเลขจึงบอกแค่การเปลี่ยนแปลง */}
        <MoneyKpi label="Gross Profit" value={t.GP} line="gp" code="GP" note={<><Delta value={changePct(t.GP, b?.GP)} /> {cmpText}</>} />
        <MoneyKpi label="Operating Profit" value={t.OP} line="op" code="OP" note={<><Delta value={changePct(t.OP, b?.OP)} /> {cmpText}</>} />
        <MoneyKpi label="PBT" value={t.PBT} line="pbt" code="PBT" note={<><Delta value={changePct(t.PBT, b?.PBT)} /> {cmpText}</>} />
      </section>

      <RatioStrip>
        <Ratio label="GP Margin" value={r(t.GP)} delta={base && <Delta value={pts("GP")} points />} />
        <Ratio label="Cost Ratio" value={r(t.TOTAL_COST)} delta={base && <Delta value={pts("TOTAL_COST")} points goodWhenUp={false} />} />
        <Ratio label="SG&A Ratio" value={r(t.SGA)} delta={base && <Delta value={pts("SGA")} points goodWhenUp={false} />} />
        <Ratio label="OP Margin" value={r(t.OP)} delta={base && <Delta value={pts("OP")} points />} />
        <Ratio label="PBT Margin" value={r(t.PBT)} delta={base && <Delta value={pts("PBT")} points />} />
      </RatioStrip>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card card-fixed card-md">
          <h2 className="card-title">แนวโน้มรายเดือน</h2>
          <p className="card-cap">{unitName} · 12 งวดล่าสุด</p>
          <div className="mb-3">
            <SegLinks label="ตัวชี้วัด" items={METRICS.map((m) => ({ href: href({ metric: m.key }), label: m.label, active: m.key === metric }))} />
          </div>
          <div className="card-body">
            {history.length < 2 ? (
              <div className="rounded-[22px] bg-surface-2 px-4 py-10 text-center text-sm text-ink-2">
                มีข้อมูล {history.length} งวด · ต้องมีอย่างน้อย 2 งวดจึงจะแสดงแนวโน้ม
              </div>
            ) : (
              <TrendChart points={trend} kind={metric === "GPM" ? "pct" : "money"} label={METRICS.find((m) => m.key === metric)!.label} color={METRIC_LINE[metric]} />
            )}
          </div>
        </section>

        <Highlights current={current} base={base} baseLabel={baseLabel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ProfitBridge statement={current} />
        <TopExpenses current={current} base={base} />
      </div>

      <CompareTable current={current} base={base} baseLabel={baseLabel} />
    </div>
  );
}

function Highlights({ current, base, baseLabel }: { current: Statement; base: Statement | null; baseLabel: string }) {
  const t = current.totals;
  const good: React.ReactNode[] = [];
  const watch: React.ReactNode[] = [];
  const r = (n: number) => ratioOf(n, t.REV);

  if (base) {
    const b = base.totals;
    const items: { label: string; now: number; before: number; upGood: boolean }[] = [
      { label: "Revenue", now: t.REV, before: b.REV, upGood: true },
      { label: "Gross Profit", now: t.GP, before: b.GP, upGood: true },
      { label: "ต้นทุนขาย", now: t.TOTAL_COST, before: b.TOTAL_COST, upGood: false },
      { label: "SG&A", now: t.SGA, before: b.SGA, upGood: false },
      { label: "Operating Profit", now: t.OP, before: b.OP, upGood: true },
      { label: "PBT", now: t.PBT, before: b.PBT, upGood: true },
    ];
    for (const i of items) {
      const diff = i.now - i.before;
      if (Math.abs(diff) < 1) continue;
      const text = <>{i.label} {diff > 0 ? "เพิ่มขึ้น" : "ลดลง"} <Money value={Math.abs(diff)} unit="long" /></>;
      ((diff > 0) === i.upGood ? good : watch).push(text);
    }
  } else {
    if (t.GP > 0) good.push(<>กำไรขั้นต้น <Money value={t.GP} unit="long" /> (GP Margin {formatPct(r(t.GP))})</>);
    if (t.OP > 0) good.push(<>กำไรจากการดำเนินงานเป็นบวก <Money value={t.OP} unit="long" /></>);
    if (t.PBT > 0) good.push(<>กำไรก่อนภาษี <Money value={t.PBT} unit="long" /></>);
    watch.push(`ต้นทุนขายคิดเป็น ${formatPct(r(t.TOTAL_COST))} ของรายได้`);
    watch.push(`SG&A คิดเป็น ${formatPct(r(t.SGA))} ของรายได้`);
    const top = expenseAccounts(current)[0];
    if (top) watch.push(<>ค่าใช้จ่ายสูงสุด: {top.name} <Money value={top.value} unit="long" /></>);
    if (t.PBT < 0) watch.push(<>ขาดทุนก่อนภาษี <Money value={-t.PBT} unit="long" /></>);
  }

  return (
    <section className="card card-fixed card-md">
      <h2 className="card-title">จุดเด่น / ประเด็นติดตาม</h2>
      <p className="card-cap">{base ? `เทียบกับ ${baseLabel}` : "ยังไม่มีงวดเปรียบเทียบ จึงสรุปจากโครงสร้างของงวดนี้"}</p>
      {/* ซ้อนแนวตั้งเสมอ: การ์ดแคบ ถ้าแบ่ง 2 คอลัมน์ ข้อความแต่ละข้อจะตัดเป็นหลายบรรทัด */}
      <div className="card-body grid content-start gap-3">
        <div className="panel panel-good">
          <PanelTitle tone="good">จุดเด่น</PanelTitle>
          <List items={good} empty="ไม่มีรายการที่ดีขึ้น" />
        </div>
        <div className="panel panel-bad">
          <PanelTitle tone="bad">ประเด็นติดตาม</PanelTitle>
          <List items={watch} empty="ไม่มีประเด็นที่ต้องติดตาม" />
        </div>
      </div>
    </section>
  );
}

function List({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  if (items.length === 0) return <p className="text-[0.8125rem] text-ink-2">{empty}</p>;
  return (
    <ul className="num list-disc space-y-0.5 pl-4 text-[0.8125rem] leading-relaxed">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/** Waterfall: รายได้ → หักต้นทุน → GP → หักค่าใช้จ่าย → OP → หักค่าเสื่อม/ดอกเบี้ย → PBT */
function ProfitBridge({ statement }: { statement: Statement }) {
  const t = statement.totals;
  const finance = financeCost(statement);
  type Step = { label: string; kind: "total" | "less"; value: number; color: string };
  const steps: Step[] = [
    { label: "รายได้รวม", kind: "total", value: t.REV, color: "var(--line-rev)" },
    { label: "ต้นทุนขาย", kind: "less", value: t.TOTAL_COST, color: "var(--seg-cogs)" },
    { label: "กำไรขั้นต้น", kind: "total", value: t.GP, color: "var(--line-gp)" },
    { label: "ค่าใช้จ่ายขาย", kind: "less", value: t.SELLING, color: "var(--seg-selling)" },
    { label: "ค่าใช้จ่ายบริหาร", kind: "less", value: t.ADMIN, color: "var(--seg-admin)" },
    { label: "กำไรจากการดำเนินงาน", kind: "total", value: t.OP, color: "var(--line-op)" },
    { label: "ค่าเสื่อมและดอกเบี้ย", kind: "less", value: finance, color: "var(--seg-finance)" },
    { label: "กำไรก่อนภาษี", kind: "total", value: t.PBT, color: "var(--line-pbt)" },
  ];

  let running = 0;
  const bars = steps.map((s) => {
    const start = s.kind === "total" ? 0 : running;
    const end = s.kind === "total" ? s.value : running - s.value;
    running = end;
    return { ...s, start, end };
  });
  const lo = Math.min(0, ...bars.flatMap((x) => [x.start, x.end]));
  const hi = Math.max(1, ...bars.flatMap((x) => [x.start, x.end]));
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <section className="card card-fixed card-sm">
      <h2 className="card-title">โครงสร้างกำไร</h2>
      <p className="card-cap">จากรายได้ หักต้นทุนและค่าใช้จ่ายทีละขั้น จนเหลือกำไรก่อนภาษี (<MoneyUnit long />)</p>
      <div className="card-body space-y-1.5">
        {bars.map((x) => {
          const neg = x.kind === "total" && x.value < 0;
          return (
            <div key={x.label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-[0.8125rem] sm:grid-cols-[10rem_1fr_auto]">
              <span className={x.kind === "total" ? "font-semibold text-navy" : "pl-3 text-ink-2"}>
                {x.kind === "less" ? "− " : ""}
                {x.label}
              </span>
              <div className="relative h-6" title={`${x.label} ${formatBaht(x.value)} บาท`}>
                {lo < 0 && <div className="absolute inset-y-0 w-0.5 rounded-full bg-line-strong" style={{ left: `${pos(0)}%` }} />}
                <div
                  className="bar-fill absolute inset-y-0.5 rounded-full"
                  style={{
                    left: `${pos(Math.min(x.start, x.end))}%`,
                    width: `${Math.max(0.6, Math.abs(pos(x.end) - pos(x.start)))}%`,
                    background: neg ? "var(--loss)" : x.color,
                    opacity: x.kind === "less" ? 0.85 : 1,
                  }}
                />
              </div>
              <span className={`num text-right ${x.kind === "total" ? "font-semibold" : "text-ink-2"} ${neg ? "text-loss-text" : ""}`}>
                {x.kind === "less" && x.value > 0 ? <Money value={x.value} minus /> : <Money value={x.kind === "less" ? -x.value : x.value} />}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopExpenses({ current, base }: { current: Statement; base: Statement | null }) {
  const top = expenseAccounts(current).slice(0, 5);
  const baseValue = (code: string) => {
    const line = base?.lines.find((l) => l.kind === "account" && l.code === code);
    return line && line.kind === "account" ? line.value : null;
  };
  const max = Math.max(1, ...top.map((x) => x.value));

  return (
    <section className="card card-fixed card-sm">
      <h2 className="card-title">Significant Expense</h2>
      <p className="card-cap">ค่าใช้จ่ายขาย บริหาร และการเงินสูงสุด 5 อันดับ (<MoneyUnit long />)</p>
      <div className="card-body">
        {top.length === 0 ? (
          <p className="text-sm text-ink-3">ไม่มีค่าใช้จ่ายในงวดนี้</p>
        ) : (
          top.map((x, i) => (
            <RankBar
              key={x.code}
              label={`${i + 1}. ${x.name}`}
              pct={(x.value / max) * 100}
              display={<Money value={x.value} />}
              tone="loss"
              badge={base ? <span className="text-xs"><Delta value={changePct(x.value, baseValue(x.code))} goodWhenUp={false} /></span> : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CompareTable({ current, base, baseLabel }: { current: Statement; base: Statement | null; baseLabel: string }) {
  const rows: { key: TotalKey | "FIN"; label: string; upGood: boolean; major?: boolean }[] = [
    { key: "REV", label: "รายได้รวม", upGood: true, major: true },
    { key: "TOTAL_COST", label: "ต้นทุนขาย", upGood: false },
    { key: "GP", label: "กำไรขั้นต้น", upGood: true, major: true },
    { key: "SELLING", label: "ค่าใช้จ่ายขาย", upGood: false },
    { key: "ADMIN", label: "ค่าใช้จ่ายบริหาร", upGood: false },
    { key: "OP", label: "กำไรจากการดำเนินงาน", upGood: true, major: true },
    { key: "FIN", label: "ค่าเสื่อมและดอกเบี้ย", upGood: false },
    { key: "PBT", label: "กำไรก่อนภาษี", upGood: true, major: true },
  ];
  const val = (s: Statement, key: TotalKey | "FIN") => (key === "FIN" ? financeCost(s) : s.totals[key]);

  return (
    <section className="card card-fixed card-lg">
      <h2 className="card-title">เปรียบเทียบรายการหลัก</h2>
      <p className="card-cap">หน่วย<MoneyUnit long /> {base ? `· เทียบ ${baseLabel}` : "· ยังไม่มีงวดเปรียบเทียบ"}</p>
      <div className="card-body">
        <table className="tbl">
          <thead>
            <tr>
              <th>รายการ</th>
              <th className="text-right!">งวดนี้</th>
              <th className="text-right!">% รายได้</th>
              <th className="text-right!">{base ? baseLabel : "เปรียบเทียบ"}</th>
              <th className="text-right!">ผลต่าง</th>
              <th className="text-right!">เปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const now = val(current, row.key);
              const before = base ? val(base, row.key) : null;
              return (
                <tr key={row.key} className={row.major ? "row-major" : ""}>
                  <td className={row.major ? "font-semibold text-navy" : "pl-6! text-ink-2"}>{row.label}</td>
                  <td className={`num text-right ${row.major ? "font-semibold" : ""} ${now < 0 ? "text-loss-text" : ""}`}><Money value={now} /></td>
                  <td className="num text-right text-ink-3">{formatPct(ratioOf(now, current.totals.REV))}</td>
                  <td className="num text-right text-ink-2">{before == null ? "—" : <Money value={before} />}</td>
                  <td className="num text-right">{before == null ? "—" : <Money value={now - before} />}</td>
                  <td className="text-right text-xs"><Delta value={changePct(now, before)} goodWhenUp={row.upGood} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
