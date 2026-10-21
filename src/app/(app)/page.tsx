import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { OverviewSkeleton, paramsKey } from "@/frontend/components/skeleton";
import { Delta, Empty, InfoRow, RankBar, pickPeriods, readParam } from "@/frontend/components/dash";
import { PeriodSelect } from "@/frontend/components/period-select";
import { Money, MoneyToggle, SignedMoney } from "@/frontend/components/money";
import { MatrixCard } from "@/frontend/components/matrix-card";
import { MonthStrip } from "@/frontend/components/month-strip";
import { MonthlyMatrix } from "@/frontend/components/monthly-matrix";
import { PageHeader } from "@/frontend/components/page-header";
import { ProfitBridge } from "@/frontend/components/profit-bridge";
import { average, costAccounts, expenseAccounts, ratioOf } from "@/backend/lib/analysis";
import { hasPermission } from "@/backend/lib/authz/scope";
import { MATRIX_SHOW_COOKIE, MONTHS_SHORT, formatPeriods, formatSignedPct, parseMatrixShow, shiftPeriod } from "@/backend/lib/format";
import { canSeeCompany, getCompanyHistory, type PeriodStatement } from "@/backend/lib/reports";
import { requirePermission } from "@/backend/lib/session";
import { sumPeriodStatements, type Statement } from "@/backend/lib/statement";

// หน้า Overview = ภาพรวมทั้งบริษัทจากชีต Monthy ในไฟล์ Master (ตาราง company_monthly) · ปีที่ไม่มีชีตนี้ใช้งบของหน่วย MSP — การเจาะลงหน่วยอยู่ที่หน้า P&L Analysis
// สถานะใน URL: ?period= เดือนเดียว / หลายเดือน (คั่นด้วย ,) / all — รูปแบบเดียวกับหน้าอื่น (PeriodSelect)

type SearchParams = Awaited<PageProps<"/">["searchParams"]>;

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  // เปลี่ยนปี/เดือน/มุมมอง → skeleton · สลับยอด/% ของตารางไม่ต้อง หน้าจะได้ไม่กระโดด
  return (
    <Suspense key={paramsKey(sp, ["show"])} fallback={<OverviewSkeleton />}>
      <DashboardContent sp={sp} />
    </Suspense>
  );
}

const monthOf = (period: string) => Number(period.slice(5, 7));
const yearBE = (year: number) => year + 543;

/** หัวการ์ด: ชื่อ + คำอธิบายด้านขวา (จอแคบเรียงลงมา) */
function CardHead({ id, title, note }: { id: string; title: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <h2 id={id} className="card-title">{title}</h2>
      <p className="text-[0.8125rem] text-ink-3">{note}</p>
    </div>
  );
}

async function DashboardContent({ sp }: { sp: SearchParams }) {
  const user = await requirePermission("dashboard.view");

  if (!canSeeCompany(user)) {
    return (
      <Empty title="หน้านี้แสดงภาพรวมทั้งบริษัท">
        <p>บัญชีนี้ดูได้เฉพาะบางหน่วย — ดูผลของหน่วยที่ได้รับสิทธิ์ที่หน้า P&amp;L Analysis</p>
        <Link href="/pnl" className="btn-primary mt-5">ไปหน้า P&amp;L Analysis</Link>
      </Empty>
    );
  }

  // ทุกเดือนที่ปิดงบของทุกปี (เรียง เก่า → ใหม่) — ตัวกรองเดือนเลือกข้ามปีได้
  // ชีต Monthy ก่อน · ปีที่ไฟล์ไม่มีชีตนี้ใช้งบของหน่วยบนสุด MSP
  const all = await getCompanyHistory(user);
  if (all.length === 0) {
    return (
      <Empty title="ยังไม่มีข้อมูลภาพรวมบริษัท">
        <p>หน้า Overview อ่านตัวเลขจากชีต Monthy ในไฟล์ Master</p>
        {hasPermission(user, "data.upload") ? (
          <Link href="/upload" className="btn-primary mt-5">นำเข้าไฟล์ Master</Link>
        ) : (
          <p className="mt-1">รอฝ่ายบัญชีนำเข้าไฟล์</p>
        )}
      </Empty>
    );
  }
  const byPeriod = new Map(all.map((h) => [h.period, h.statement]));
  const periods = all.map((h) => h.period).reverse();
  const pick = pickPeriods(periods, readParam(sp, "period"));
  // ตารางรายเดือนแสดงเป็นยอดเงินหรือ % — สลับในเบราว์เซอร์ทันที จำไว้ใน cookie
  const show = parseMatrixShow((await cookies()).get(MATRIX_SHOW_COOKIE)?.value);

  // เดือนเดียว = งบของเดือนนั้น เทียบเดือนก่อนหน้า · หลายเดือน = งบรวมของเดือนที่เลือก (ไม่มีงวดเทียบ)
  const statement = pick.multi ? sumPeriodStatements(pick.list.map((p) => byPeriod.get(p)!)) : byPeriod.get(pick.last)!;
  const previousPeriod = pick.multi ? null : shiftPeriod(pick.last, -1);
  const previous = previousPeriod ? byPeriod.get(previousPeriod) : undefined;

  // แถบรายเดือน สรุป และตาราง = ปีของเดือนล่าสุดที่เลือก
  const year = Number(pick.last.slice(0, 4));
  const month = monthOf(pick.last);
  const history = all.filter((h) => Number(h.period.slice(0, 4)) === year);
  const byMonth = new Map(history.map((h) => [monthOf(h.period), h.statement]));
  const upTo = history.filter((h) => monthOf(h.period) <= month);
  const ytd = sumPeriodStatements(upTo.map((h) => h.statement));
  const current = byMonth.get(month)!;
  const picked = new Set(pick.list);
  const t = statement.totals;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`ภาพรวมทั้งบริษัท · ${formatPeriods(pick.list, pick.all)}`}
        caption={<Headline revenue={t.REV} pbt={t.PBT} />}
        actions={
          <>
            <PeriodSelect periods={periods} value={pick.list} all={pick.all} />
            <MoneyToggle />
          </>
        }
      />

      <section aria-labelledby="bridge-title" className="card">
        <CardHead
          id="bridge-title"
          title="เส้นทางจากรายได้สู่กำไร"
          note={
            previous && previousPeriod ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                <span aria-hidden className="bridge-ref-stop" />
                ตัวเลขสีใต้สถานี = เปลี่ยนจาก <b className="font-semibold text-ink-2">{MONTHS_SHORT[monthOf(previousPeriod) - 1]} {yearBE(Number(previousPeriod.slice(0, 4)))}</b>
                <span className="text-ink-3">· ชี้แท่งเพื่อดูยอดเต็ม</span>
              </span>
            ) : (
              "ตัวเลขใต้สถานี = % ของรายได้ · ชี้แท่งเพื่อดูยอดเต็ม"
            )
          }
        />
        {t.REV === 0 ? (
          <p className="mt-4 text-sm text-ink-2">งวดนี้ไม่มีรายได้ จึงไม่แสดงเส้นทางจากรายได้</p>
        ) : (
          <ProfitBridge statement={statement} previous={previous} />
        )}
      </section>

      <section aria-labelledby="strip-title" className="card">
        <CardHead
          id="strip-title"
          title={`กำไรก่อนภาษีรายเดือน ปี ${yearBE(year)}`}
          note="แท่งสีม่วง = เดือนที่เลือกที่ตัวกรองเดือน"
        />
        <div className="mstrip-scroll">
          <MonthStrip
            months={MONTHS_SHORT.map((_, i) => {
              const m = i + 1;
              const s = byMonth.get(m);
              return { month: m, pbt: s ? s.totals.PBT : null, current: picked.has(`${year}-${String(m).padStart(2, "0")}-01`) };
            })}
          />
        </div>
      </section>

      {/* สรุป + ต้นทุนที่ขยับ + ค่าใช้จ่ายที่ขยับ: จอกว้างมาก 3 คอลัมน์ · จอกลางสรุปเต็มแถวแล้วต้นทุน/ค่าใช้จ่ายคู่กัน */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card lg:col-span-2 2xl:col-span-1">
          <h2 className="card-title">สรุปสำหรับผู้บริหาร</h2>
          <p className="card-cap">ปี {yearBE(year)} ปิดงบแล้ว {history.length} เดือน</p>
          <YearSummary ytd={ytd} upTo={upTo} current={current} previous={byMonth.get(month - 1)} month={month} />
        </section>
        <Movers kind="cost" count={pick.list.length} month={month} current={current} selected={statement} history={history} />
        <Movers kind="expense" count={pick.list.length} month={month} current={current} selected={statement} history={history} />
      </div>

      <MatrixCard
        initial={show}
        title={`งบกำไรขาดทุนรายเดือน ปี ${yearBE(year)}`}
        source={history.some((h) => h.source === "msp") ? "ตามงบของ MSP ในไฟล์ Master (ไฟล์ปีนี้ไม่มีชีต Monthy)" : "ตามชีต Monthy ในไฟล์ Master"}
      >
        <MonthlyMatrix months={byMonth} total={sumPeriodStatements(history.map((h) => h.statement))} current={pick.multi ? null : month} />
      </MatrixCard>
    </div>
  );
}

function Headline({ revenue, pbt }: { revenue: number; pbt: number }) {
  if (revenue === 0) return <>ไม่มีรายได้ในงวดนี้</>;
  const margin = formatSignedPct(ratioOf(pbt, revenue));
  if (pbt < 0) return <>รายได้รวม <Money value={revenue} unit="long" /> แต่<span className="font-semibold text-loss-text">ขาดทุนก่อนภาษี <Money value={-pbt} unit="long" /></span> ({margin})</>;
  return <>รายได้รวม <Money value={revenue} unit="long" /> เหลือเป็นกำไรก่อนภาษี <Money value={pbt} unit="long" /> ({margin})</>;
}

/** ขั้นในสะพานกำไรที่ใช้หาว่าขั้นไหนขยับมากสุด (จุด % ของรายได้ — บวก = กินกำไรมากขึ้น) */
const STEPS = [
  { label: "ต้นทุนเพื่อขาย", of: (s: Statement) => s.totals.TOTAL_COST },
  { label: "ค่าใช้จ่ายขายและบริหาร", of: (s: Statement) => s.totals.SGA },
  { label: "ค่าเสื่อมและดอกเบี้ย", of: (s: Statement) => s.totals.OP - s.totals.PBT },
];

/**
 * สรุปสิ่งที่แถบรายเดือนไม่ได้บอก: ผลสะสมถึงเดือนที่เลือก · กำไรเฉลี่ยต่อเดือน · ขั้นที่ขยับมากสุดเทียบเดือนก่อน · เดือนที่ขาดทุน
 * แถวเรียบในการ์ดเดียว (ไม่ซ้อนกล่อง) · จุดหน้าแถว = สีสายของตัวเลขนั้น
 */
function YearSummary({ ytd, upTo, current, previous, month }: {
  ytd: Statement; upTo: PeriodStatement[]; current: Statement; previous?: Statement; month: number;
}) {
  const losses = upTo.filter((h) => h.statement.totals.PBT < 0).map((h) => MONTHS_SHORT[monthOf(h.period) - 1]);
  const avgPbt = average(upTo.map((h) => h.statement.totals.PBT)) ?? 0;
  const moved = previous
    ? STEPS.map((s) => ({ label: s.label, pts: (ratioOf(s.of(current), current.totals.REV) ?? 0) - (ratioOf(s.of(previous), previous.totals.REV) ?? 0) }))
      .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))[0]
    : null;
  const range = upTo.length > 1 ? `${MONTHS_SHORT[monthOf(upTo[0].period) - 1]}–${MONTHS_SHORT[month - 1]}` : MONTHS_SHORT[month - 1];
  const dot = (c: string) => <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: c }} />;
  return (
    // เต็มแถว (จอกลาง) = ผลสะสม กับ ประเด็นติดตาม วางคู่กัน · จอกว้างมาก (การ์ดแคบ 1 ใน 3) = เรียงลงมา
    <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2 2xl:grid-cols-1">
      <div>
        <h3 className="summary-head">ผลสะสม {range}</h3>
        <InfoRow label={<>{dot("var(--line-rev)")}รายได้รวม</>} value={<Money value={ytd.totals.REV} unit="short" />} />
        <InfoRow
          label={<>{dot("var(--line-pbt)")}กำไรก่อนภาษี</>}
          value={<span className={ytd.totals.PBT < 0 ? "text-loss-text" : ""}><SignedMoney value={ytd.totals.PBT} unit="short" /></span>}
          sub={formatSignedPct(ratioOf(ytd.totals.PBT, ytd.totals.REV))}
        />
        <InfoRow label={<>{dot("var(--line-pbt)")}เฉลี่ยต่อเดือน</>} value={<SignedMoney value={avgPbt} unit="short" />} />
      </div>
      <div className="mt-4 lg:mt-0 2xl:mt-4">
        <h3 className="summary-head">ประเด็นติดตาม {MONTHS_SHORT[month - 1]}</h3>
        {moved && (
          <InfoRow
            label="ขั้นที่ขยับมากสุด"
            value={moved.label}
            sub={<Delta value={moved.pts} goodWhenUp={false} label={`เทียบ ${MONTHS_SHORT[month - 2]}`} />}
          />
        )}
        <InfoRow
          label="เดือนที่ขาดทุน"
          value={losses.length ? <span className="text-loss-text">{losses.join(", ")}</span> : "ไม่มี"}
          sub={losses.length ? <span className="badge badge-bad">ขาดทุน {losses.length} เดือน</span> : undefined}
        />
      </div>
    </div>
  );
}

/** ชุดบัญชีของการ์ด "ขยับมากสุด": ต้นทุน (ต้นทุนขาย + ต้นทุนอื่น) หรือค่าใช้จ่าย (ขาย บริหาร ค่าเสื่อม ดอกเบี้ย) · line = สีของขั้นนั้นในสะพานกำไร */
const MOVER_KINDS = {
  cost: {
    noun: "ต้นทุน",
    cap: "ต้นทุนขายและต้นทุนอื่น",
    note: "สินค้าคงเหลือสุทธิ = ต้นงวด − ปลายงวด · ไม่รวมบัญชีพักที่หักล้างกันเอง (ต้นทุนขาย/ยอดสูญเสียกับบัญชีพัก)",
    line: "var(--seg-cogs)",
    accounts: costAccounts,
  },
  expense: {
    noun: "ค่าใช้จ่าย",
    cap: "ค่าใช้จ่ายขาย บริหาร ค่าเสื่อม และดอกเบี้ย",
    note: null,
    line: "var(--seg-admin)",
    accounts: expenseAccounts,
  },
} as const;

/**
 * บัญชีต้นทุน / ค่าใช้จ่ายที่ขยับมากสุด
 * เลือกเดือนเดียว = ขยับมากสุด (บาท) เทียบค่าเฉลี่ยของเดือนก่อนหน้าในปีเดียวกัน · หลายเดือน (หรือเดือนแรกของปี) = บัญชีที่ใหญ่สุดของงบที่เลือก
 */
function Movers({ kind, count, month, current, selected, history }: {
  kind: keyof typeof MOVER_KINDS; count: number; month: number; current: Statement; selected: Statement; history: PeriodStatement[];
}) {
  const k = MOVER_KINDS[kind];
  const before = history.filter((h) => monthOf(h.period) < month).map((h) => h.statement);
  const moving = count === 1 && before.length > 0;
  const title = (text: string) => (
    <h2 className="card-title flex items-center gap-2">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: k.line }} />
      {text}
    </h2>
  );
  // หมายเหตุขอบเขตบัญชีอยู่ใต้รายการ หัวการ์ดทั้งสองใบจึงสูงเท่ากัน แถวตรงแนวกัน
  const note = k.note && <p className="mt-3 text-xs leading-relaxed text-ink-3">{k.note}</p>;

  if (!moving) {
    const base = selected;
    const list = k.accounts(base).slice(0, 7);
    const max = Math.max(1, ...list.map((a) => Math.abs(a.value)));
    return (
      <section className="card card-fixed card-sm movers">
        {title(`${k.noun}หลัก${count > 1 ? ` รวม ${count} เดือน` : ""}`)}
        <p className="card-cap">{k.cap} · เรียงจากมากไปน้อย</p>
        <div className="card-body">
          {list.map((a) => (
            <RankBar key={a.code} label={a.name} pct={(Math.abs(a.value) / max) * 100} display={<SignedMoney value={a.value} />} badge={<span className="num text-xs text-ink-3">{formatSignedPct(ratioOf(a.value, base.totals.REV))}</span>} />
          ))}
        </div>
        {note}
      </section>
    );
  }

  const avgOf = (code: string) => average(before.map((s) => k.accounts(s).find((a) => a.code === code)?.value ?? 0)) ?? 0;
  // บัญชีที่เดือนนี้เป็น 0 แต่เดือนก่อนๆ มียอด ก็นับว่าขยับ (ลดลงทั้งก้อน)
  const codes = new Map<string, string>();
  for (const s of [current, ...before]) for (const a of k.accounts(s)) if (!codes.has(a.code)) codes.set(a.code, a.name);
  const now = new Map(k.accounts(current).map((a) => [a.code, a.value]));
  const rows = [...codes]
    .map(([code, name]) => ({ code, name, value: now.get(code) ?? 0, avg: avgOf(code) }))
    .map((a) => ({ ...a, diff: a.value - a.avg }))
    .filter((a) => Math.abs(a.diff) >= 0.5)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 7);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));
  return (
    <section className="card card-fixed card-sm movers">
      {title(`${k.noun}ที่ขยับมากสุด ${MONTHS_SHORT[month - 1]}`)}
      <p className="card-cap">{k.cap} · เทียบค่าเฉลี่ย {before.length} เดือนก่อนหน้า · แท่ง = ส่วนต่างเป็นบาท</p>
      <div className="card-body">
        {rows.map((r) => (
          <RankBar
            key={r.code}
            label={r.name}
            pct={(Math.abs(r.diff) / max) * 100}
            tone={r.diff > 0 ? "loss" : "good"}
            display={<>{r.diff > 0 ? "+" : "−"}<Money value={Math.abs(r.diff)} /></>}
            badge={<span className="text-xs"><Delta value={r.avg === 0 ? null : (r.diff / Math.abs(r.avg)) * 100} goodWhenUp={false} /></span>}
          />
        ))}
      </div>
      {note}
    </section>
  );
}
