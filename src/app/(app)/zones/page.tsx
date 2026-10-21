import Link from "next/link";
import { Suspense } from "react";
import { ZonesSkeleton, paramsKey } from "@/frontend/components/skeleton";
import { Empty, InfoRow, Kpi, NoData, PanelTitle, RankBar, Roundel, SegLinks, pickPeriods, readParam } from "@/frontend/components/dash";
import { Icon } from "@/frontend/components/icons";
import { TimelineKpi, loadKpiTimelines } from "@/frontend/components/kpi-timeline";
import { BranchRankChart } from "./branch-rank-chart";
import { RouteLine } from "@/frontend/components/route-line";
import { BranchFilter } from "@/frontend/components/branch-filter";
import { PageHeader } from "@/frontend/components/page-header";
import { PeriodSelect } from "@/frontend/components/period-select";
import { UnitDetail } from "@/frontend/components/unit-detail";
import { average, classifyUnits, expenseAccounts, pooledRatio, ratioOf } from "@/backend/lib/analysis";
import { Money, MoneyToggle, MoneyUnit } from "@/frontend/components/money";
import { formatPct, formatPeriods } from "@/backend/lib/format";
import { getStatements, listPeriods, listUnits, periodsByUnit, treeYearOf, type UnitNode } from "@/backend/lib/reports";
import { db } from "@/backend/db";
import { listZones } from "@/backend/lib/import-workbook";
import { branchPerSqm, getZoneSalesBenchmark, readBranchAreas, SALES_GROUP, salesAreaMonths } from "@/backend/lib/sales-benchmark";
import { requirePermission } from "@/backend/lib/session";
import { sumStatements, type Statement } from "@/backend/lib/statement";

type Metric = "rev" | "gpm" | "pbtm";
const METRICS: { key: Metric; label: string; long: string }[] = [
  // รายได้: เทียบรายได้จากการขาย (Group A) ต่อ ตร.ม. กับเกณฑ์ของโซน (src/backend/lib/sales-benchmark.ts) — ไม่ใช่ค่าเฉลี่ยของสาขา
  { key: "rev", label: "รายได้/ตร.ม.", long: "รายได้จากการขาย (Group A) ต่อ ตร.ม." },
  { key: "gpm", label: "GP Margin", long: "GP Margin (%)" },
  { key: "pbtm", label: "PBT Margin", long: "PBT Margin (%)" },
];

// โซนที่ไม่ใช่สาขาตามจังหวัด — ปุ่มเลือกโซนไม่เติมคำว่า "สาขา" นำหน้า
const NOT_BRANCH_ZONES = new Set(["ปั่นดี", "vansales", "ขนมจีนบุฟเฟ่"]);

/** ชื่อบนปุ่มเลือกโซน: เติม "สาขา" เฉพาะชื่อจังหวัดภาษาไทย (เช่น เชียงใหม่ → สาขาเชียงใหม่) — ชื่อภาษาอังกฤษอย่าง "Sales Zone (Sz) Zone-CMI" ใช้ตามเดิม */
function zoneLabel(name: string) {
  if (name.startsWith("สาขา") || name.startsWith("โซน") || NOT_BRANCH_ZONES.has(name) || !/^[฀-๿]/.test(name)) return name;
  return `สาขา${name}`;
}

/**
 * salesA = รายได้จากการขาย (Group A) ของงวดที่เลือก · area = ตร.ม. (null = ไม่มีข้อมูล)
 * metric = ค่าที่ใช้เทียบเกณฑ์ · null = เทียบไม่ได้ (เกณฑ์รายได้: มี Group A แต่ไม่มี ตร.ม.)
 */
type Branch = UnitNode & { s: Statement; salesA: number; area: number | null; metric: number | null };

/** หน่วยของเกณฑ์รายได้ */
const PER_SQM = "บาท/ตร.ม.";

type SearchParams = Awaited<PageProps<"/zones">["searchParams"]>;

export default async function ZonesPage({ searchParams }: PageProps<"/zones">) {
  const sp = await searchParams;
  // เปลี่ยนงวด/โซน/เกณฑ์ → แสดง skeleton ระหว่างโหลด; คลิกดูสาขา (unit) ไม่ต้อง เพราะต้องเลื่อนไปที่ #anchor
  return (
    <Suspense key={paramsKey(sp, ["unit"])} fallback={<ZonesSkeleton />}>
      <ZonesContent sp={sp} />
    </Suspense>
  );
}

async function ZonesContent({ sp }: { sp: SearchParams }) {
  const user = await requirePermission("dashboard.view");
  const periods = await listPeriods(user);
  if (periods.length === 0 || !user.defaultUnit) return <NoData user={user} />;

  // งวดเดียวหรือหลายเดือนรวมกัน (?period=a,b หรือ all)
  const pick = pickPeriods(periods, readParam(sp, "period"));
  const period = pick.param;
  const periodLabel = formatPeriods(pick.list, pick.all);
  const metric = (METRICS.some((m) => m.key === readParam(sp, "metric")) ? readParam(sp, "metric") : "rev") as Metric;
  const metricInfo = METRICS.find((m) => m.key === metric)!;

  // โซนและสาขาตามผังของปีเดือนล่าสุดที่เลือก (ตร.ม. ของปีนั้นด้วย)
  const treeYear = treeYearOf(pick.sel);
  // เฉพาะหน่วยที่มีงบในงวดที่เลือก — ผังของปีมีสาขาที่ยังไม่เปิด/ปิดไปแล้ว (เช่น ปั่นดีมีสาขาไม่เท่ากันแต่ละเดือน)
  const [unitNodes, zoneDefs] = await Promise.all([listUnits(user, treeYear, pick.list), listZones(db, treeYear)]);
  const { zones } = classifyUnits(unitNodes);
  // ชื่อกลุ่มในผังลงท้ายด้วยชื่อในผังของโซน (เช่น "Sales Zone (Sz) CMI") → แสดงเฉพาะชื่อโซนภาษาไทย ("โซนเชียงใหม่") ตัดชื่อประเภทนำหน้าออก
  // หน่วยแม่ของกลุ่มคือโหนดโซน: รหัสโซน (หน่วยงานเริ่มต้น) หรือ <หน่วยงาน>-รหัสโซน
  const displayName = (z: { name: string; parentCode: string | null }) => {
    const def = zoneDefs.find((d) => z.parentCode === d.code || z.parentCode?.endsWith(`-${d.code}`));
    const at = def ? z.name.lastIndexOf(def.name) : -1;
    return def && at >= 0 ? `${def.label}${z.name.slice(at + def.name.length)}` : z.name;
  };
  if (zones.length === 0) {
    return <Empty title="ไม่มีโซนขายในสิทธิ์ของบัญชีนี้">หน้านี้แสดงหน่วยที่มีสาขาย่อย เช่น เชียงใหม่ น่าน สุโขทัย</Empty>;
  }

  const branchCodes = zones.flatMap((z) => z.branches.map((b) => b.code));
  // หลายเดือน: เกณฑ์รายได้คิดเป็น บาท/ตร.ม./เดือน — ตัวหาร = ตร.ม.×เดือนที่สาขามียอดขายจริง (สาขาเปิดกลางช่วงไม่ถูกหารด้วยเดือนที่ยังไม่เปิด)
  const multiMonth = pick.list.length > 1;
  const perSqmUnit = multiMonth ? `${PER_SQM}/เดือน` : PER_SQM;
  const benchFormula = multiMonth ? "Group A ÷ (ตร.ม. × เดือนที่ขาย) ของสาขา" : "Group A ÷ ตร.ม. ของสาขา";
  const [statements, areas, areaMonths] = await Promise.all([
    getStatements(user, pick.sel, [...zones.map((z) => z.code), ...branchCodes]),
    readBranchAreas(db, treeYear, branchCodes),
    multiMonth ? salesAreaMonths(db, pick.list, branchCodes) : null,
  ]);
  const st = (code: string) => statements.get(code)!;
  /** ตัวหารของเกณฑ์รายได้: เดือนเดียว = ตร.ม. · หลายเดือน = ตร.ม.×เดือนที่ขาย */
  const divisorOf = (code: string) => (areaMonths ? areaMonths.get(code) ?? null : areas.get(code) ?? null);
  /** รายได้จากการขาย (Group A) = แถวบัญชีรหัส A ในงบ (ไม่รวม B อาหาร, C รายได้อื่น, M ส่วนลดรับ) */
  const salesOf = (s: Statement) => s.lines.reduce((t, l) => (l.kind === "account" && l.code === SALES_GROUP ? t + l.value : t), 0);
  const metricOf = (code: string, s: Statement): number | null =>
    metric === "rev" ? branchPerSqm(salesOf(s), divisorOf(code)) : metric === "gpm" ? (ratioOf(s.totals.GP, s.totals.REV) ?? 0) : (ratioOf(s.totals.PBT, s.totals.REV) ?? 0);
  const fmt = (n: number): React.ReactNode => (metric === "rev" ? <Money value={n} /> : formatPct(n));

  // โซนที่ไม่มีตัวเลขในงวดที่เลือก (เช่น vansales มีเฉพาะบางเดือน) ไม่แสดงปุ่ม/ไม่นำมาเทียบ
  const hasData = (s: Statement) => s.lines.some((l) => l.kind !== "heading" && l.value !== 0);
  const activeZones = zones.filter((z) => hasData(st(z.code)) || z.branches.some((b) => hasData(st(b.code))));
  if (activeZones.length === 0) {
    return (
      <Empty title={`ไม่มีข้อมูลโซนขายในงวด ${periodLabel}`}>
        <p>เลือกงวดอื่น หรือรอฝ่ายบัญชีนำเข้าข้อมูลของงวดนี้</p>
        <div className="mt-4 flex justify-center"><PeriodSelect periods={periods} value={pick.list} all={pick.all} /></div>
      </Empty>
    );
  }

  // สรุปโซน: สาขาที่มีรายได้เท่านั้นที่นับเป็นสาขาขาย (ออฟฟิศโซนไม่มีรายได้) · only = กรองเฉพาะสาขาที่เลือก
  // compared = สาขาที่นำมาเทียบเกณฑ์: เกณฑ์รายได้ = มี Group A · GP/PBT Margin = มีรายได้ (เหมือนเดิม)
  const summarize = (z: (typeof activeZones)[number], only?: Set<string>) => {
    // ไม่มีงบในงวดที่เลือก = ยังไม่เปิด/ปิดไปแล้ว ไม่นับเป็นสาขาของโซน (ต่างจาก "ไม่มีรายได้" ที่มีงบแต่รายได้เป็นศูนย์)
    const branches: Branch[] = z.branches
      .filter((b) => st(b.code).lines.length > 0 && (!only || only.has(b.code)))
      .map((b) => ({ ...b, s: st(b.code), salesA: salesOf(st(b.code)), area: areas.get(b.code) ?? null, metric: metricOf(b.code, st(b.code)) }));
    const selling = branches.filter((b) => b.s.totals.REV > 0);
    const compared = metric === "rev" ? branches.filter((b) => b.salesA > 0) : selling;
    const marginRows = compared.map((b) => ({ value: metric === "pbtm" ? b.s.totals.PBT : b.s.totals.GP, revenue: b.s.totals.REV }));
    return {
      ...z,
      name: displayName(z),
      s: st(z.code),
      branches,
      selling,
      compared,
      support: branches.filter((b) => b.s.totals.REV === 0),
      // เกณฑ์ GP/PBT Margin = margin รวมของสาขาที่มีรายได้ (GP หรือ PBT รวม ÷ รายได้รวม) ถ่วงน้ำหนักตามยอดขาย
      // สาขาเล็ก/เพิ่งเปิดที่ % ผิดปกติไม่ดึงเกณฑ์ทั้งโซน · เกณฑ์รายได้ต่อ ตร.ม. คิดแยกด้านล่าง (สูตรรวมยอดแบบเดียวกัน)
      marginBench: metric === "rev" ? null : pooledRatio(marginRows),
      /** ที่มาของเกณฑ์ margin (การ์ดย่อยข้าง Branch Ranking): GP หรือ PBT รวม และรายได้รวม ของสาขาที่นำมาเทียบ */
      marginValue: marginRows.reduce((s, r) => s + r.value, 0),
      marginRevenue: marginRows.reduce((s, r) => s + r.revenue, 0),
      lossCount: branches.filter((b) => b.s.totals.PBT < 0).length,
    };
  };
  // ทุกโซน (ไม่กรองสาขา) — ใช้กับปุ่มเลือกโซนและแถบลำดับ
  const zoneSummaries = activeZones.map((z) => summarize(z));

  const zoneParam = readParam(sp, "zone");
  const zoneInfo = activeZones.find((z) => z.code === zoneParam) ?? activeZones[0];

  // ตัวกรองเดือนกับสาขากรองกันเอง (แบบ Slicer ของ Excel):
  // ตัวเลือกสาขา = สาขาที่มีข้อมูลในเดือนที่เลือก · ตัวเลือกเดือน = เดือนที่สาขาที่กรองไว้มีข้อมูล
  const branchPeriods = await periodsByUnit(user, zoneInfo.branches.map((b) => b.code));
  const branchOptions = zoneInfo.branches.filter((b) => pick.list.some((p) => branchPeriods.get(b.code)?.has(p)));
  // ตัวกรองสาขาแบบ Excel (?branch=code1,code2) — ไม่ระบุ/เลือกครบ = ทุกสาขา · สาขาที่ไม่มีข้อมูลในเดือนที่เลือกหลุดจากตัวกรอง
  const picked = new Set((readParam(sp, "branch") ?? "").split(",").filter((c) => branchOptions.some((b) => b.code === c)));
  const filtering = picked.size > 0 && picked.size < branchOptions.length;
  const periodOptions = filtering ? periods.filter((p) => [...picked].some((c) => branchPeriods.get(c)?.has(p))) : periods;
  const zone = summarize(zoneInfo, filtering ? picked : undefined);
  // งบหลักของการ์ด REV/GP/OP/PBT: ทั้งโซน หรือผลรวมของสาขาที่กรองไว้
  const totals = filtering ? sumStatements(zone.branches.map((b) => b.s)).totals : zone.s.totals;
  // เกณฑ์รายได้ = Group A รวม ÷ ตร.ม. รวม ของทั้งโซน (ไม่ขึ้นกับตัวกรองสาขา) · GP/PBT Margin = GP/PBT รวม ÷ รายได้รวม ของสาขาที่แสดง
  const salesBench = metric === "rev"
    ? await getZoneSalesBenchmark(db, pick.list, zoneInfo.code, zoneInfo.branches.map((b) => ({ code: b.code, salesA: salesOf(st(b.code)), area: divisorOf(b.code) })))
    : null;
  const bench = salesBench ? salesBench.perSqm : zone.marginBench;
  // สาขาที่เทียบได้เรียงจากสูงไปต่ำ แล้วต่อด้วยสาขาที่เทียบไม่ได้ (มี Group A แต่ไม่มี ตร.ม.)
  const rated = zone.compared.filter((b): b is Branch & { metric: number } => b.metric != null).sort((a, b) => b.metric - a.metric);
  const unrated = zone.compared.filter((b) => b.metric == null);
  const ranked: Branch[] = [...rated, ...unrated];
  // Zone Insight: 5 สาขาค่าสูงสุด (มากไปน้อย) และ 5 สาขาค่าต่ำสุด (น้อยไปมาก) — สาขาน้อยกว่า 10 ไม่ให้ซ้ำกับฝั่งสูงสุด
  // ทั้งสองฝั่งเรียงจากค่ามากไปน้อย และนับ 1–5 ในการ์ดของตัวเอง — ฝั่งต่ำสุด สาขาที่ค่าน้อยที่สุดอยู่แถวที่ 5 (ไม่ใช่แถวที่ 1)
  const top5 = rated.slice(0, 5).map((b, i) => ({ ...b, rank: i + 1 }));
  const bottom5 = rated.slice(Math.max(top5.length, rated.length - 5)).map((b, i) => ({ ...b, rank: i + 1 }));
  const pass = bench == null ? [] : rated.filter((b) => b.metric >= bench);
  const fail = bench == null ? [] : rated.filter((b) => b.metric < bench);
  const benchText = bench == null ? "—" : <>{fmt(bench)}{metric === "rev" && ` ${perSqmUnit}`}</>;
  const lossTotal = zone.branches.reduce((s, b) => (b.s.totals.PBT < 0 ? s + b.s.totals.PBT : s), 0);
  // สาขาที่คลิกดูรายละเอียด (เฉพาะสาขาในโซนที่เลือก) — แสดงในหน้านี้ ไม่พาไปหน้าอื่น
  const selected = zone.branches.find((b) => b.code === readParam(sp, "unit"));
  const href = (next: Record<string, string | undefined>) => {
    const params: Record<string, string | undefined> = {
      period, zone: zone.code, metric, branch: filtering ? [...picked].join(",") : undefined, unit: selected?.code, ...next,
    };
    return `/zones?${new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]))}`;
  };
  // เปิดดูสาขา = หน้ารายละเอียดของสาขานั้น ไม่ต้องเลื่อนไปที่ anchor (ส่วนอื่นของหน้าถูกซ่อนทั้งหมด)
  const unitHref = (code: string) => href({ unit: code });

  const route = (
    <RouteLine
        label="ตำแหน่งในโซนขาย"
        stops={[
          { label: "Sales Zone", sub: `${zoneSummaries.length} โซน`, state: "past" as const },
          { label: zone.name, sub: `${zone.branches.length} สาขา`, href: selected ? href({ unit: undefined }) : undefined, instant: true, state: selected ? ("past" as const) : ("now" as const) },
          selected
            ? { label: selected.name, sub: "ดูงบด้านล่าง", state: "now" as const }
            : { label: "สาขา", sub: "คลิกชื่อสาขาเพื่อดูงบ", state: "next" as const },
        ]}
      />
  );

  // ดูรายละเอียดสาขา: ซ่อนตัวกรอง KPI ของโซน อันดับ และตารางทั้งหมด — เหลือหัวหน้า แถบตำแหน่ง (กดกลับโซนได้) และการ์ดของสาขา
  if (selected) {
    return (
      <div className="space-y-4">
        <PageHeader title="Sales Zone Performance" caption={`${periodLabel} · รายละเอียดสาขา`} actions={<MoneyToggle />} />
        {route}
        <UnitDetail title={`รายละเอียดสาขา · ${zone.name}`} name={selected.name} statement={selected.s} closeHref={href({ unit: undefined })} source={{ unit: selected.code, periods: pick.list, periodLabel }} />
      </div>
    );
  }

  // Timeline รายเดือนของการ์ดงบหลัก (เลือกทั้งปี/ทุกเดือนที่มี): ยอดชุดเดียวกับการ์ด — ทั้งโซน หรือรวมสาขาที่กรองไว้
  const timelines = await loadKpiTimelines(user, pick, periodOptions, filtering ? zone.branches.map((b) => b.code) : [zone.code]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Zone Performance"
        caption={`${periodLabel} · ${metric === "rev" ? "เทียบสาขาในโซนกับเกณฑ์รายได้ต่อ ตร.ม. ของโซน" : "เทียบสาขาในโซนกับ margin รวมของโซน"} · ${metricInfo.long}`}
        actions={<MoneyToggle />}
      />

      {route}

      {/* relative z-10: ให้กล่องตัวกรองสาขาลอยเหนือแถวถัดไป
          ต่ำกว่าแถบเมนูบนมือถือ (z-20) เพื่อไม่ทับเมนูตอนเลื่อนหน้า */}
      {/* สมมาตร: โซน (ซ้าย) และเกณฑ์วัด (ขวา) เป็นแถบเม็ดยาแบบเดียวกัน · ตัวกรองเดือน+สาขาอยู่กึ่งกลางพอดี (grid 1fr auto 1fr) สูงเท่ากันทั้งแถว */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="lg:justify-self-start">
          <SegLinks
            label="เลือกโซน"
            items={zoneSummaries.map((z) => ({ href: href({ zone: z.code, branch: undefined, unit: undefined }), label: zoneLabel(z.name), active: z.code === zone.code }))}
          />
        </div>
        {/* ตัวกรองเดือนและสาขาอยู่คู่กันกลางแถว */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PeriodSelect periods={periods} value={pick.list} all={pick.all} fixed available={periodOptions} />
          <BranchFilter
            // เปลี่ยนเดือนแล้วตัวเลือกสาขาเปลี่ยน → สร้างใหม่ให้การติ๊กตรงกับตัวเลือกชุดใหม่
            key={`${zone.code}|${period}`}
            branches={branchOptions.map((b) => ({ code: b.code, name: b.name }))}
            selected={filtering ? [...picked] : null}
          />
        </div>
        <div className="lg:justify-self-end">
          <SegLinks label="เกณฑ์วัด" items={METRICS.map((m) => ({ href: href({ metric: m.key }), label: m.label, active: m.key === metric }))} />
        </div>
      </div>

      <section aria-label="ตัวเลขหลักของโซน" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {/* ชื่อโซนอยู่ที่ปุ่มเลือกโซนและแถบลำดับแล้ว — การ์ดนี้บอกจำนวนสาขา (ตัวหารของการ์ดอื่น) */}
        <Kpi
          label={filtering ? "สาขาที่เลือก" : "สาขาในโซน"}
          value={zone.branches.length}
          unit="สาขา"
          line="msp"
          code="SZ"
          note={filtering
            ? `จาก ${branchOptions.length} สาขาในโซน · มีรายได้ ${zone.selling.length}`
            : `มีรายได้ ${zone.selling.length} · ไม่มีรายได้ ${zone.support.length}`}
        />
        {salesBench ? (
          <Kpi
            label="เกณฑ์ รายได้/ตร.ม."
            value={bench == null ? "—" : fmt(bench)}
            line="ink"
            code="BM"
            note={bench == null
              ? "ยังไม่มีข้อมูล ตร.ม. — นำเข้าไฟล์ที่มีชีต Branch_Area หรือเพิ่มในแอปหลังบ้าน (Branch Area)"
              : undefined}
          />
        ) : (
          <Kpi
            label={`เกณฑ์ ${metricInfo.label}`}
            value={bench == null ? "—" : fmt(bench)}
            line="ink"
            code="BM"
            note={`${metric === "gpm" ? "GP" : "PBT"} รวม ÷ รายได้รวม ของสาขาที่มีรายได้ (ถ่วงตามยอดขาย)`}
          />
        )}
        <BenchmarkSplit
          pass={pass.length}
          fail={fail.length}
          note={metric === "rev"
            ? `จาก ${rated.length} สาขาที่มี Group A และ ตร.ม.${unrated.length ? ` · ไม่มี ตร.ม. ${unrated.length}` : ""}`
            : `จาก ${rated.length} สาขาที่มีรายได้`}
        />
        {/* ขาดทุน = PBT ติดลบ (คนละเรื่องกับต่ำกว่าเกณฑ์) นับทุกสาขารวมที่ไม่มีรายได้ */}
        <Kpi
          label="สาขาขาดทุน"
          value={zone.lossCount}
          unit="สาขา"
          line="msp"
          code="LOSS"
          negative={zone.lossCount > 0}
          note={zone.lossCount > 0
            ? <>ขาดทุนรวม <Money value={lossTotal} unit="long" /></>
            : "ทุกสาขากำไรหรือเท่าทุน"}
        />
      </section>

      {/* ตัวเลขงบหลักแบบเดียวกับหน้า Overview: ทั้งโซน หรือรวมเฉพาะสาขาที่กรองไว้ */}
      <section aria-label={filtering ? "งบหลักของสาขาที่เลือก" : "งบหลักของโซน"} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <TimelineKpi timelines={timelines} metric="REV" label="รายได้รวม" value={totals.REV} line="rev" code="REV" note="รายได้จากการขายและบริการ" />
        <TimelineKpi timelines={timelines} metric="GP" label="กำไรขั้นต้น" value={totals.GP} line="gp" code="GP" note="รายได้หักต้นทุนขาย" />
        <TimelineKpi timelines={timelines} metric="OP" label="กำไรจากการดำเนินงาน" value={totals.OP} line="op" code="OP" note="หักค่าใช้จ่ายขายและบริหาร" />
        <TimelineKpi timelines={timelines} metric="PBT" label="กำไรก่อนภาษี" value={totals.PBT} line="pbt" code="PBT" note="หักค่าเสื่อมและดอกเบี้ย" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* ไม่ตัดขอบการ์ด (ไม่ใช้ card-fixed): การ์ด Nope ที่ขยายและ tooltip ของกราฟลอยพ้นการ์ดได้ */}
        <section className="card flex flex-col">
          {/* หัวการ์ด: ชื่อ + คำอธิบาย แล้วการ์ดเล็กที่มาของเกณฑ์อยู่ใต้หัวเสมอ (ทุกเกณฑ์วัด) — ตำแหน่งไม่ขึ้นกับความยาวคำอธิบาย */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="min-w-0">
              <h2 className="card-title">Branch Ranking — {metricInfo.label}</h2>
              {/* จอแคบจองไว้ 2 บรรทัด: คำอธิบายของแต่ละเกณฑ์ยาวไม่เท่ากัน การ์ดย่อยด้านล่างจึงไม่ขยับขึ้นลง */}
              <p className="card-cap mb-0! line-clamp-2 min-h-[2lh] sm:min-h-0">
                เรียงจากสูงไปต่ำ · {salesBench?.perSqm != null
                  ? benchFormula
                  : metric !== "rev" && bench != null
                    ? `${metric === "gpm" ? "GP" : "PBT"} ÷ รายได้ ของสาขา · เกณฑ์ = รวมยอดทั้งโซน`
                    : <>เกณฑ์ {benchText}{metric === "rev" && ` · ${benchFormula}`}</>}
              </p>
            </div>
            {/* จอกว้าง: 3 ใบกว้างเท่ากันเรียงแถวเดียว · จอแคบ: เรียงลงเป็นแถว ชื่อซ้าย ตัวเลขขวา */}
            {salesBench?.perSqm != null && (
              <dl className="grid w-full gap-2 sm:w-[29rem] sm:grid-cols-3" aria-label="ที่มาของเกณฑ์รายได้ต่อ ตร.ม.">
                <BenchStat color="var(--line-rev)" label="รายได้จากการขาย" unit="บาท" value={<Money value={salesBench.salesA} />} />
                <BenchStat
                  color="var(--line-op)"
                  label={multiMonth ? "พื้นที่ × เดือนที่ขาย" : "พื้นที่รวม"}
                  unit={multiMonth ? "ตร.ม.·เดือน" : "ตร.ม."}
                  value={sqm.format(salesBench.area)}
                />
                <BenchStat color="var(--line-pbt)" label="เกณฑ์" unit={perSqmUnit} value={fmt(salesBench.perSqm)} />
              </dl>
            )}
            {/* เกณฑ์ GP/PBT Margin: รายได้รวม · GP หรือ PBT รวม · เกณฑ์ (รวมยอด ÷ รายได้รวม) — รูปแบบเดียวกับเกณฑ์รายได้ต่อ ตร.ม. */}
            {metric !== "rev" && bench != null && (
              <dl className="grid w-full gap-2 sm:w-[29rem] sm:grid-cols-3" aria-label={`ที่มาของเกณฑ์ ${metricInfo.label}`}>
                <BenchStat color="var(--line-rev)" label="รายได้รวม" unit="บาท" value={<Money value={zone.marginRevenue} />} />
                <BenchStat
                  color={metric === "gpm" ? "var(--line-gp)" : "var(--line-pbt)"}
                  label={metric === "gpm" ? "กำไรขั้นต้นรวม" : "กำไรก่อนภาษีรวม"}
                  unit="บาท"
                  value={<Money value={zone.marginValue} />}
                />
                <BenchStat color="var(--line-op)" label="เกณฑ์" unit="ของรายได้" value={fmt(bench)} />
              </dl>
            )}
          </div>
          <BranchRankChart
            rows={rated.map((b) => ({ code: b.code, name: b.name, value: b.metric, href: unitHref(b.code) }))}
            missing={[...unrated].sort((a, b) => b.salesA - a.salesA).map((b) => ({ code: b.code, name: b.name, sales: b.salesA, href: unitHref(b.code) }))}
            bench={bench}
            metric={metric}
            metricLabel={metricInfo.label}
            unit={metric === "rev" ? perSqmUnit : undefined}
          />
        </section>

        <section className="card card-fixed card-md">
          <h2 className="card-title">Zone Insight</h2>
          <p className="card-cap">5 สาขาที่ {metricInfo.label} สูงสุดและต่ำสุด{metric === "rev" && ` (${perSqmUnit})`}</p>
          <div className="card-body">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="panel panel-good">
                <PanelTitle tone="good">สูงสุด 5 อันดับ</PanelTitle>
                <NameList rows={top5} fmt={fmt} empty={metric === "rev" ? "ยังไม่มีสาขาที่มีข้อมูล ตร.ม." : "ไม่มีสาขาที่มีรายได้"} />
              </div>
              <div className="panel panel-bad">
                <PanelTitle tone="bad">ต่ำสุด 5 อันดับ</PanelTitle>
                <NameList rows={bottom5} fmt={fmt} empty={top5.length ? "สาขาทั้งหมดอยู่ในอันดับสูงสุดแล้ว" : "—"} />
              </div>
            </div>
            {zone.support.length > 0 && <NoRevenue rows={zone.support} />}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <LossRanking rows={zone.branches} hrefFor={unitHref} />
        <KeyDrivers zone={zone.selling} />
      </div>

      {/* ค่ากลางของโซนคิดจากทุกสาขาที่มีรายได้ (ไม่กรอง) — กรองสาขาแล้วยังเทียบกับทั้งโซน */}
      <CostAnomalies rows={zone.selling} baseline={zoneSummaries.find((z) => z.code === zone.code)?.selling ?? zone.selling} hrefFor={unitHref} />

      <section className="card card-fixed card-xl">
        <h2 className="card-title">Branch Detail</h2>
        <p className="card-cap">{zone.name} · ดูงบกำไรขาดทุนเต็มของสาขาได้จาก Branch Ranking, Loss Ranking หรือ ต้นทุน / ค่าใช้จ่ายสูงผิดปกติ</p>
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr>
                <th>สาขา</th>
                <th className="text-right!">รายได้ (<MoneyUnit />)</th>
                <th className="text-right!">ตร.ม.</th>
                <th className="text-right!">GP Margin</th>
                <th className="text-right!">SG&A / รายได้</th>
                <th className="text-right!">PBT (<MoneyUnit />)</th>
                <th className="text-right!">เทียบเกณฑ์</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((b) => {
                // เทียบไม่ได้ = ยังไม่มีเกณฑ์ หรือสาขาไม่มี ตร.ม. (เกณฑ์รายได้)
                const diff = b.metric == null || bench == null ? null : b.metric - bench;
                const t = b.s.totals;
                return (
                  <tr key={b.code}>
                    <td>
                      <span className="font-semibold">{b.name}</span>
                    </td>
                    <td className="num text-right"><Money value={t.REV} /></td>
                    <td className="num text-right">{b.area == null ? <span className="text-ink-3">—</span> : sqm.format(b.area)}</td>
                    <td className="num text-right">{formatPct(ratioOf(t.GP, t.REV))}</td>
                    <td className="num text-right">{formatPct(ratioOf(t.SGA, t.REV))}</td>
                    <td className={`num text-right font-semibold ${t.PBT < 0 ? "text-loss-text" : "text-good"}`}><Money value={t.PBT} /></td>
                    {diff == null ? (
                      <td className="num text-right text-ink-3">—</td>
                    ) : (
                      <td className={`num text-right ${diff >= 0 ? "text-good" : "text-loss-text"}`}>
                        {diff >= 0 ? "+" : ""}
                        {fmt(diff)}
                      </td>
                    )}
                    <td>
                      <StatusBadge diff={diff} noArea={metric === "rev" && b.metric == null} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/**
 * เทียบเกณฑ์ในการ์ดเดียว: ผ่าน | ต่ำกว่า เคียงกัน + แถบสัดส่วน — ตัวหารเดียวกัน (สาขาที่มีรายได้) จึงรวมเป็นใบเดียว
 * ต่ำกว่าเกณฑ์ไม่ใช่ขาดทุน จึงใช้สีเตือน (ไม่ใช่สีแดงขาดทุน) · มีคำว่า ผ่าน/ต่ำกว่า กำกับ ไม่พึ่งสีอย่างเดียว
 */
function BenchmarkSplit({ pass, fail, note }: { pass: number; fail: number; note: string }) {
  const total = pass + fail;
  return (
    <div className="kpi">
      <div className="kpi-head">
        <Roundel line="gp" code="PASS" small />
        <div className="min-w-0 truncate text-sm font-medium text-ink-2">เทียบเกณฑ์</div>
      </div>
      <div className="kpi-body">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="num text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] text-good">{pass}</span>
            <span className="ml-1.5 text-[0.8125rem] text-ink-2">ผ่าน</span>
          </div>
          <div className="min-w-0 border-l border-line pl-3">
            <span className="num text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] text-(--warn-text)">{fail}</span>
            <span className="ml-1.5 text-[0.8125rem] text-ink-2">ต่ำกว่า</span>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span className="bg-(--good)" style={{ width: `${(pass / total) * 100}%` }} />
            <span className="ml-0.5 flex-1 rounded-full bg-(--warn-text) opacity-60" />
          </div>
        )}
        <div className="kpi-note num mt-1.5 text-[0.8125rem] leading-snug text-ink-3">{note}</div>
      </div>
    </div>
  );
}

const sqm = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * การ์ดเล็กที่มาของเกณฑ์ (หัวการ์ด Branch Ranking): รายได้จากการขาย ÷ พื้นที่รวม = เกณฑ์
 * แบบทางการ: พื้นกลางสีเดียวกันทุกใบ ขนาดเท่ากัน · สีบทบาทของข้อมูลอยู่ที่เครื่องหมายหน้าชื่อเท่านั้น
 * (รายได้ = น้ำเงิน · พื้นที่ = อำพัน · เกณฑ์ = ม่วง — ไม่ใช้แดง/เขียวที่หมายถึงขาดทุน/ผ่าน)
 * ตัวเลขน้ำหนักเท่ากันทุกใบ หน่วยเป็นตัวเล็กต่อท้าย · จอแคบ: ชื่อซ้าย ตัวเลขขวา
 */
function BenchStat({ color, label, unit, value }: { color: string; label: string; unit: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 rounded-[12px] bg-surface-2 px-3 py-2 sm:block">
      <dt className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] leading-tight text-ink-2">
        <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="flex flex-wrap items-baseline justify-end gap-x-1 leading-tight sm:mt-1 sm:justify-start">
        <span className="num text-sm font-semibold whitespace-nowrap text-ink">{value}</span>
        <span className="text-[0.6875rem] whitespace-nowrap text-ink-3">{unit}</span>
      </dd>
    </div>
  );
}

/** ผ่าน / ต่ำกว่าเกณฑ์ · เทียบไม่ได้: สาขาไม่มี ตร.ม. หรือยังไม่มีเกณฑ์ */
function StatusBadge({ diff, noArea }: { diff: number | null; noArea: boolean }) {
  if (noArea) return <span className="badge badge-muted">ไม่มี ตร.ม.</span>;
  if (diff == null) return <span className="badge badge-muted">ไม่มีเกณฑ์</span>;
  const ok = diff >= 0;
  return <span className={`badge ${ok ? "badge-good" : "badge-bad"}`}>{ok ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์"}</span>;
}

/** อันดับสาขาใน Zone Insight (เทียบได้แล้วเท่านั้น metric จึงไม่เป็น null): ลำดับ 1–5 · ชื่อ · ค่า */
function NameList({ rows, fmt, empty }: { rows: (Branch & { metric: number; rank: number })[]; fmt: (n: number) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <p className="text-[0.8125rem] text-ink-2">{empty}</p>;
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((r) => (
        <li key={r.code} className="flex items-baseline gap-2">
          <span className="num w-4 shrink-0 text-xs font-semibold text-ink-3">{r.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
          <span className="num shrink-0 text-ink-2">{fmt(r.metric)}</span>
        </li>
      ))}
    </ol>
  );
}

function LossRanking({ rows, hrefFor }: { rows: Branch[]; hrefFor: (code: string) => string }) {
  const losses = rows.filter((r) => r.s.totals.PBT < 0).sort((a, b) => a.s.totals.PBT - b.s.totals.PBT);
  const max = Math.max(1, ...losses.map((r) => -r.s.totals.PBT));
  const total = losses.reduce((s, r) => s + r.s.totals.PBT, 0);
  return (
    <section className="card card-fixed card-lg">
      <h2 className="card-title">Loss Ranking</h2>
      <p className="card-cap">
        {losses.length === 0 ? "ไม่มีหน่วยขาดทุนในโซนนี้" : <>{losses.length} หน่วยขาดทุน รวม <Money value={total} unit="long" /> · เรียงตามขาดทุนก่อนภาษี</>}
      </p>
      <div className="card-body pr-1">
        {losses.map((r, i) => (
          <RankBar
            key={r.code}
            label={`${i + 1}. ${r.name}`}
            href={hrefFor(r.code)}
            pct={(-r.s.totals.PBT / max) * 100}
            display={<Money value={r.s.totals.PBT} />}
            tone="loss"
          />
        ))}
      </div>
    </section>
  );
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** รายการใช้จ่ายที่มากที่สุดของสาขา (ขาย บริหาร ค่าเสื่อม ดอกเบี้ย) */
const topExpense = (s: Statement) => expenseAccounts(s)[0];

/** value/mid = % ต่อรายได้ · amount = ยอดต้นทุน/SG&A (บาท) · excess = ส่วนที่เกินค่ากลางโซน (บาท) ใช้เรียงตามผลกระทบจริง */
type Anomaly = { branch: Branch; kind: "cost" | "sga"; value: number; mid: number; amount: number; excess: number };

/**
 * สาขาที่สัดส่วนต้นทุน/ค่าใช้จ่ายต่อรายได้สูงผิดปกติเมื่อเทียบค่ากลางของโซน
 * ผิดปกติ = สูงกว่ามัธยฐานเกิน 2 เท่าของ MAD (ปรับสเกล 1.4826) และห่างอย่างน้อย 5 จุด % — ทนต่อสาขาที่ค่าสุดโต่ง ไม่ดึงค่ากลางเหมือนค่าเฉลี่ย
 */
function findAnomalies(rows: Branch[], baseline: Branch[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const kind of ["cost", "sga"] as const) {
    const pct = (b: Branch) => ratioOf(kind === "cost" ? b.s.totals.TOTAL_COST : b.s.totals.SGA, b.s.totals.REV) ?? 0;
    const values = baseline.map(pct);
    const mid = median(values);
    const spread = 1.4826 * median(values.map((v) => Math.abs(v - mid)));
    for (const b of rows) {
      const value = pct(b);
      const gap = value - mid;
      if (gap >= 5 && (spread === 0 ? gap >= 10 : gap / spread >= 2)) {
        const amount = kind === "cost" ? b.s.totals.TOTAL_COST : b.s.totals.SGA;
        out.push({ branch: b, kind, value, mid, amount, excess: amount - (mid / 100) * b.s.totals.REV });
      }
    }
  }
  // เรียงตามยอดเงินที่เกินค่ากลาง — สาขารายได้น้อยมากมี % สูงลิ่วแต่ผลกระทบน้อย ไม่ควรขึ้นก่อน
  return out.sort((a, b) => b.excess - a.excess);
}

const ANOMALY_LANES = [
  { kind: "cost", title: "ต้นทุนขายสูง", metric: "ต้นทุนรวม" },
  { kind: "sga", title: "ค่าใช้จ่ายขายและบริหารสูง", metric: "SG&A" },
] as const;

/**
 * แยกเป็น 2 ช่อง: ต้นทุนขายสูง | ค่าใช้จ่ายขายและบริหาร (SG&A) สูง — แต่ละช่องมีหัวติดด้านบน (จำนวนสาขา · ค่ากลางโซน)
 * แถว: ชื่อสาขา + ยอดที่เกินค่ากลาง (ตัวเลขชิดขวา ใช้เรียง) + แถบยาวตามยอดที่เกินเทียบสาขาที่เกินมากสุดในช่อง
 * สาขาที่อยู่ทั้งสองช่องมีป้าย "สูงทั้งสองด้าน" · ทั้งแถวเป็นลิงก์ไปหน้ารายละเอียดสาขา
 */
function CostAnomalies({ rows, baseline, hrefFor }: { rows: Branch[]; baseline: Branch[]; hrefFor: (code: string) => string }) {
  const items = findAnomalies(rows, baseline);
  const lanes = ANOMALY_LANES.map((lane) => ({ ...lane, items: items.filter((a) => a.kind === lane.kind) }));
  const [cost, sga] = lanes.map((l) => new Set(l.items.map((a) => a.branch.code)));
  const both = new Set([...cost].filter((code) => sga.has(code)));
  const caption = items.length === 0
    ? "ไม่พบสาขาที่สัดส่วนต้นทุนหรือค่าใช้จ่ายต่อรายได้สูงผิดปกติ"
    : [
        `ต้นทุนขายสูง ${cost.size} สาขา`,
        `SG&A สูง ${sga.size} สาขา`,
        both.size > 0 && `สูงทั้งสองด้าน ${both.size} สาขา`,
      ].filter(Boolean).join(" · ") + " — เทียบค่ากลางของสาขาที่มีรายได้ในโซน";

  return (
    <section className="card card-fixed card-md">
      <h2 className="card-title">ต้นทุน / ค่าใช้จ่ายสูงผิดปกติ</h2>
      <p className="card-cap">{caption}</p>
      {items.length > 0 && (
        <div className="card-body -mx-2.5 grid content-start gap-x-8 gap-y-5 px-2.5 lg:grid-cols-2">
          {lanes.map((lane) => (
            <AnomalyLane key={lane.kind} lane={lane} both={both} hrefFor={hrefFor} />
          ))}
        </div>
      )}
    </section>
  );
}

function AnomalyLane({ lane, both, hrefFor }: {
  lane: (typeof ANOMALY_LANES)[number] & { items: Anomaly[] };
  both: Set<string>;
  hrefFor: (code: string) => string;
}) {
  const maxExcess = Math.max(...lane.items.map((a) => a.excess), 1);
  const mid = lane.items[0]?.mid;
  const headingId = `anomaly-${lane.kind}`;
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      {/* หัวช่องติดด้านบนตอนเลื่อน — จอแคบที่สองช่องเรียงลง หัวช่องที่สองดันหัวแรกขึ้นไป */}
      <header className="sticky top-0 z-[1] -mx-2.5 border-b border-line bg-surface px-2.5 pt-1 pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={headingId} className="text-sm font-semibold text-ink">
            {lane.title}
            <span className="num ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">{lane.items.length}</span>
          </h3>
          {lane.items.length > 0 && <span className="shrink-0 text-xs text-ink-3">เกินค่ากลาง (<MoneyUnit />)</span>}
        </div>
        {mid != null && <p className="num mt-0.5 text-xs text-ink-3">ค่ากลางโซน {lane.metric} {formatPct(mid)} ของรายได้</p>}
      </header>
      {lane.items.length === 0 ? (
        <p className="py-3 text-[0.8125rem] text-ink-3">ไม่มีสาขาที่{lane.title}ผิดปกติ</p>
      ) : (
        <ol>
          {lane.items.map((a) => {
            const top = a.kind === "sga" ? topExpense(a.branch.s) : undefined;
            return (
              <li key={a.branch.code} className="border-b border-line last:border-0">
                <Link
                  href={hrefFor(a.branch.code)}
                  className="group -mx-2.5 block rounded-[14px] px-2.5 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-semibold group-hover:text-brand group-hover:underline">{a.branch.name}</span>
                      {both.has(a.branch.code) && <span className="badge badge-warn shrink-0">สูงทั้งสองด้าน</span>}
                    </span>
                    <span className="num shrink-0 text-sm font-semibold text-(--warn-text)">+<Money value={a.excess} /></span>
                  </div>
                  {/* แถบยาวตามยอดที่เกินค่ากลาง เทียบสาขาที่เกินมากสุดในช่องนี้ */}
                  <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-(--warn)" style={{ width: `${Math.max(3, (a.excess / maxExcess) * 100)}%` }} />
                  </span>
                  {/* เกินรายได้ (มากกว่า 100%) → % ไม่มีความหมาย แสดงยอดเงินเทียบรายได้แทน */}
                  <div className="num mt-1.5 text-xs text-ink-2">
                    {a.value > 100 ? (
                      <>{lane.metric} <Money value={a.amount} unit="short" /> เกินรายได้ (<Money value={a.branch.s.totals.REV} unit="short" />)</>
                    ) : (
                      <>{lane.metric} <b className="font-semibold text-ink">{formatPct(a.value)}</b> ของรายได้</>
                    )}
                    {top && <span className="text-ink-3"> · สูงสุด: {top.name} <Money value={top.value} unit="short" /></span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * แผงย่อยใน Zone Insight: สาขาที่ไม่มีรายได้ (ไม่นับในเกณฑ์) — ยอดใช้จ่ายรวมและรายการที่ใช้มากสุด เรียงจากใช้จ่ายมากไปน้อย
 * โทนกลาง (ไม่ใช่ดี/แย่) เพราะเป็นสาขาสนับสนุนหรือเพิ่งเปิด ไม่ใช่สาขาที่ทำผลงานต่ำ
 */
function NoRevenue({ rows }: { rows: Branch[] }) {
  const spend = (b: Branch) => b.s.totals.TOTAL_COST + b.s.totals.SGA + (b.s.totals.OP - b.s.totals.PBT);
  const sorted = [...rows].sort((a, b) => spend(b) - spend(a));
  // โครงเดียวกับแผงอันดับด้านบน (ไอคอนในวงกลม · ลำดับ · ชื่อ · ตัวเลขชิดขวา) — หน่วยอยู่ที่หัวคอลัมน์ ตัวเลขทุกแถวจึงชิดขวาตรงกัน
  return (
    <div className="panel mt-3">
      <h3 className="panel-title text-ink-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface text-ink-3">
          <Icon name="flat" size={12} stroke={2.6} />
        </span>
        <span className="min-w-0 flex-1 truncate">ไม่มีรายได้ {rows.length} สาขา · ไม่นับในเกณฑ์</span>
        <span className="shrink-0 text-xs font-normal text-ink-3">ค่าใช้จ่าย (<MoneyUnit />)</span>
      </h3>
      {/* แถวละบรรทัดเดียวให้แผงเล็ก — รายการที่ใช้มากสุดดูได้เมื่อชี้ที่ชื่อสาขา */}
      <ol className="space-y-1 text-sm">
        {sorted.map((b, i) => {
          const top = topExpense(b.s);
          return (
            <li key={b.code} className="flex items-baseline gap-2">
              <span className="num w-4 shrink-0 text-xs font-semibold text-ink-3">{i + 1}</span>
              <span title={top ? `ใช้มากสุด: ${top.name}` : "ไม่มีค่าใช้จ่ายขายและบริหาร"} className="min-w-0 flex-1 truncate font-medium">
                {b.name}
              </span>
              <span className="num shrink-0 text-ink-2"><Money value={spend(b)} /></span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * หาสาเหตุร่วมของสาขาขาดทุน เทียบกับสาขาขายในโซน
 * GP Margin / SG&A ของโซน = รวมยอด ÷ รายได้รวม (ถ่วงตามยอดขาย แบบเดียวกับเกณฑ์) · ยอดขายเทียบค่าเฉลี่ยต่อสาขา
 */
function KeyDrivers({ zone }: { zone: Branch[] }) {
  const gpm = (b: Branch) => ratioOf(b.s.totals.GP, b.s.totals.REV) ?? 0;
  const sga = (b: Branch) => ratioOf(b.s.totals.SGA, b.s.totals.REV) ?? 0;
  const avgGpm = pooledRatio(zone.map((b) => ({ value: b.s.totals.GP, revenue: b.s.totals.REV }))) ?? 0;
  const avgSga = pooledRatio(zone.map((b) => ({ value: b.s.totals.SGA, revenue: b.s.totals.REV }))) ?? 0;
  const avgRev = average(zone.map((b) => b.s.totals.REV)) ?? 0;
  const losing = zone.filter((b) => b.s.totals.PBT < 0);

  const drivers = [
    {
      tone: "panel-bad",
      title: "GP Margin ต่ำกว่าโซน",
      rule: `โซน ${formatPct(avgGpm)}`,
      hits: losing.filter((b) => gpm(b) < avgGpm),
      text: "กำไรขั้นต้นไม่พอรองรับค่าใช้จ่ายคงที่ สาขาจะขาดทุนได้เร็ว",
    },
    {
      tone: "panel-warn",
      title: "SG&A สูงเมื่อเทียบยอดขาย",
      rule: `โซน ${formatPct(avgSga)}`,
      hits: losing.filter((b) => sga(b) > avgSga),
      text: "ค่าแรง ค่าเช่า และค่าใช้จ่ายประจำกด Operating Profit",
    },
    {
      tone: "panel-good",
      title: "ยอดขายต่ำกว่าค่าเฉลี่ยโซน",
      rule: <>ค่าเฉลี่ย <Money value={avgRev} unit="short" /></>,
      hits: losing.filter((b) => b.s.totals.REV < avgRev),
      text: "ใช้สาขาขนาดใกล้กันที่มีกำไรเป็น Benchmark เพื่อหาช่องว่าง",
    },
  ];

  return (
    <section className="card card-fixed card-lg">
      <h2 className="card-title">Key Drivers</h2>
      <p className="card-cap">ปัจจัยที่พบในสาขาขาดทุน {losing.length} สาขา (เทียบกับโซน)</p>
      <div className="card-body space-y-2.5">
        {drivers.map((d) => (
          <div key={d.title} className={`panel ${d.tone}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{d.title}</h3>
              <span className="badge badge-muted shrink-0">{d.hits.length} สาขา</span>
            </div>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{d.text} · {d.rule}</p>
            {d.hits.length > 0 && <InfoRow label="เช่น" value={d.hits.slice(0, 4).map((h) => h.name).join(", ")} />}
          </div>
        ))}
      </div>
    </section>
  );
}
