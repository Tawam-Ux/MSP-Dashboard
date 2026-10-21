// โครงหน้าระหว่างโหลด (skeleton) — ขนาด/ตำแหน่งเท่าหน้าจริง จึงไม่กระโดดเมื่อข้อมูลมาถึง
// อนิเมชัน (ดู globals.css): จางเข้าทั้งก้อนหลังหน่วงสั้นๆ (โหลดเร็วจะไม่เห็น skeleton เลย) แล้วนิ่ง ไม่กะพริบ

import { SkeletonSync } from "./skeleton-sync";

/** แท่งสีเทาแทนข้อความ/ตัวเลข */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skel block ${className}`} />;
}

/** ห่อทั้งหน้า: บอก screen reader ว่ากำลังโหลด */
export function PageSkeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="skel-page space-y-4">
      <SkeletonSync />
      <span className="sr-only">กำลังโหลด{label}…</span>
      {children}
    </div>
  );
}

/** หัวหน้า: ชื่อ + คำอธิบาย + ตัวเลือกด้านขวา — กล่องสูงเท่าบรรทัดจริงของ <PageHeader> (ชื่อ 1.625/1.875rem leading-tight · คำอธิบาย text-sm) */
export function SkHeader({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex h-[2.03125rem] items-center sm:h-[2.34375rem]"><Bone className="h-8 w-60" /></div>
        <div className="mt-1.5 flex h-5 items-center"><Bone className="h-4 w-80 max-w-[70vw]" /></div>
      </div>
      {actions > 0 && (
        <div className="flex gap-2.5">
          {Array.from({ length: actions }, (_, i) => <Bone key={i} className="h-11 w-36" />)}
        </div>
      )}
    </div>
  );
}

/**
 * แถว KPI 4 ใบ — ใช้คลาส .kpi และกล่องสูงเท่าบรรทัดจริงของ <Kpi> (ป้าย text-sm · ตัวเลข 1.75rem leading-tight · หมายเหตุ leading-snug)
 * การ์ดจึงสูงเท่ากันพอดี ตอนเนื้อหาจริงแทนที่ แถวด้านล่างไม่กระตุก
 */
export function SkKpis({ count = 4, barAt }: { count?: number; barAt?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi">
          <div className="kpi-head">
            <Bone className="size-[2.125rem] shrink-0" />
            <Bone className="h-3.5 w-24" />
          </div>
          <div className="kpi-body">
            <div className="flex h-[2.1875rem] items-center"><Bone className="h-7 w-36 max-w-full" /></div>
            {/* barAt = ใบที่มีแถบสัดส่วนใต้ตัวเลข (เช่น เทียบเกณฑ์ ในหน้า Sales Zone) — แถวทั้งแถวสูงตามใบนี้ */}
            {i === barAt && <Bone className="mt-1.5 h-1.5 w-full" />}
            <div className={`${i === barAt ? "mt-1.5" : "mt-0.5"} flex h-[1.1172rem] items-center`}><Bone className="h-3 w-40 max-w-full" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

type SkStop = { now?: boolean; sub?: boolean };

/**
 * แถบเส้นทางสถานี — โครงเดียวกับ <RouteLine> (.stop-link: จุด · ชื่อ · บรรทัดย่อย เว้น 0.375rem)
 * ความสูงขึ้นกับสถานีปัจจุบัน (จุดใหญ่ ชื่อตัวหนา) และสถานีที่มีบรรทัดย่อย จึงส่งรูปแบบสถานีให้ตรงกับหน้าจริง
 */
export function SkRoute({ stops }: { stops: SkStop[] }) {
  return (
    <div className="route">
      <div className="flex">
        {stops.map((s, i) => (
          <div key={i} className="flex min-w-[8.5rem] flex-1 flex-col items-center gap-1.5">
            <Bone className={s.now ? "-mt-1 size-8" : "size-6"} />
            {/* สถานีปัจจุบันที่ไม่มีบรรทัดย่อยวัดได้สูงกว่า 1px (วัดจากหน้าจริง) */}
            <div className={`flex items-center ${s.now ? (s.sub ? "h-[1.18rem]" : "h-[1.24rem]") : "h-[1.1rem]"}`}><Bone className="h-3.5 w-24" /></div>
            {s.sub && <div className="-mt-1 flex h-[1.2rem] items-center"><Bone className="h-3 w-20" /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** แถบอัตราส่วน 5 ช่อง — โครงเดียวกับ <RatioStrip>/<Ratio> (ป้าย 0.8125rem × 1.6 · ค่า text-lg) */
export function SkRatios() {
  return (
    <div className="ratio-strip">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="ratio-card">
          <div className="flex h-[1.3rem] items-center"><Bone className="h-3 w-16" /></div>
          <div className="flex h-7 items-center"><Bone className="h-5 w-14" /></div>
        </div>
      ))}
    </div>
  );
}

/** แถบตัวเลือกแบบเม็ดยา — สูงเท่า .seg จริง (2.75rem) */
export function SkSeg({ items = 3 }: { items?: number }) {
  return (
    <div className="flex h-11 items-center gap-1.5">
      {Array.from({ length: items }, (_, i) => <Bone key={i} className="h-9 w-28 rounded-full" />)}
    </div>
  );
}

type Body = "lines" | "bars" | "chart" | "table";
type Size = "sm" | "md" | "lg" | "xl";

/**
 * ความสูงคงที่ของการ์ด skeleton = ความสูงของการ์ดจริง (ไม่ใช่ตามจำนวนแท่ง) — ข้อมูลมาแล้วการ์ดไม่ยืด/หด
 * การ์ดจริงที่เนื้อหายาวจะสูงเต็มเพดานของขนาดนั้น (.card-sm ฯลฯ ใน globals.css) จึงใช้เพดานเป็นค่าเริ่มต้น
 * การ์ดจริงที่สูงไม่ถึงเพดาน ส่ง height (คลาส Tailwind) ที่วัดจากหน้าจริงแทน
 */
const FULL_HEIGHT: Record<Size, string> = {
  sm: "lg:h-[28rem]",
  md: "h-[32rem]",
  lg: "h-[36rem]",
  xl: "h-[42rem]",
};

/** การ์ด: หัวการ์ด + เนื้อหาตามชนิด · size = ขนาดมาตรฐานเดียวกับการ์ดจริง · height = ความสูงของการ์ดจริงเมื่อไม่เต็มเพดาน */
export function SkCard({ body = "lines", rows = 5, size, height, className = "" }: { body?: Body; rows?: number; size?: Size; height?: string; className?: string }) {
  const h = height ?? (size ? FULL_HEIGHT[size] : "");
  return (
    <div className={`card ${size ? `card-fixed card-${size}` : ""} overflow-hidden ${h} ${className}`}>
      <Bone className="h-4 w-40" />
      <Bone className="mt-2 mb-5 h-3 w-64 max-w-full" />
      {body === "lines" && (
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => <Bone key={i} className={`h-3.5 ${i % 3 === 2 ? "w-3/5" : i % 2 ? "w-4/5" : "w-full"}`} />)}
        </div>
      )}
      {body === "bars" && (
        <div className="space-y-3.5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3">
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3 rounded-full" />
              <Bone className="h-3.5 w-full" />
            </div>
          ))}
        </div>
      )}
      {body === "chart" && <Bone className="h-52 w-full rounded-[22px]" />}
      {body === "table" && <SkTableRows rows={rows} />}
    </div>
  );
}

function SkTableRows({ rows }: { rows: number }) {
  return (
    <div>
      <Bone className="h-9 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-line px-3 py-3 last:border-0">
          <Bone className="h-3.5 w-4/5" />
          <Bone className="ml-auto h-3.5 w-3/4" />
          <Bone className="ml-auto h-3.5 w-2/3" />
          <Bone className="ml-auto h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** สองคอลัมน์ 1.5 : 1 แบบที่หน้า Dashboard ใช้ */
export function SkSplit({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">{children}</div>;
}

// โครงทั้งหน้าของแต่ละหน้า dashboard — ใช้ทั้งใน loading.tsx (ตอนเปลี่ยนเมนู)
// และ <Suspense> ในหน้า (ตอนเปลี่ยนงวด/หน่วย/ตัวเลือกในหน้าเดิม)

/** หน้า Overview: สะพานกำไร · แท่งกำไรรายเดือน · สรุป + ค่าใช้จ่าย · ตารางรายเดือน */
export function OverviewSkeleton() {
  return (
    <PageSkeleton label="ภาพรวม">
      <SkHeader actions={2} />
      <div className="card">
        <Bone className="h-4 w-52" />
        <div className="mt-5 grid grid-cols-7 items-end gap-3.5" style={{ height: "clamp(12rem, 30vh, 18rem)" }}>
          {[100, 82, 18, 15, 4, 3, 3].map((h, i) => (
            <div key={i} className="flex h-full items-end px-[24%]">
              <span aria-hidden className="skel block w-full rounded-[12px]" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
        <Bone className="mt-3 h-1.5 w-full" />
        <div className="mt-4 grid grid-cols-7 gap-3.5">
          {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="mx-auto h-12 w-20" />)}
        </div>
      </div>
      <div className="card">
        <Bone className="h-4 w-60" />
        <Bone className="mt-5 h-36 w-full rounded-[18px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SkCard body="lines" rows={6} className="lg:col-span-2 2xl:col-span-1" />
        <SkCard body="bars" rows={7} size="sm" />
        <SkCard body="bars" rows={7} size="sm" />
      </div>
      <SkCard body="table" rows={10} />
    </PageSkeleton>
  );
}

export function PnlSkeleton() {
  return (
    <PageSkeleton label="P&L Analysis">
      <SkHeader actions={3} />
      <SkRoute stops={[{ now: true }]} />
      <SkSeg />
      <SkKpis />
      <SkRatios />
      <SkSplit>
        <SkCard body="chart" size="md" height="h-[423px]" />
        <SkCard body="lines" rows={6} size="md" height="h-[423px]" />
      </SkSplit>
      <SkSplit>
        <SkCard body="bars" rows={6} size="sm" height="lg:h-[339px]" />
        <SkCard body="bars" rows={5} size="sm" height="lg:h-[339px]" />
      </SkSplit>
      <SkCard body="table" rows={8} size="lg" height="h-[505px]" />
    </PageSkeleton>
  );
}

export function ZonesSkeleton() {
  return (
    <PageSkeleton label="Sales Zone">
      <SkHeader actions={1} />
      <SkRoute stops={[{ sub: true }, { now: true, sub: true }, { sub: true }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-11 w-32" />)}
        </div>
        {/* ตัวกรองเดือน + สาขา */}
        <div className="flex gap-3">
          <Bone className="h-11 w-40" />
          <Bone className="h-11 w-60" />
        </div>
        <SkSeg />
      </div>
      <SkKpis barAt={2} />
      <SkKpis />
      <SkSplit>
        <SkCard body="bars" rows={10} size="md" />
        <SkCard body="lines" rows={8} size="md" />
      </SkSplit>
      <SkSplit>
        <SkCard body="bars" rows={10} size="lg" />
        <SkCard body="lines" rows={12} size="lg" />
      </SkSplit>
      {/* ต้นทุน/ค่าใช้จ่ายสูงผิดปกติ */}
      <SkCard body="lines" rows={8} size="md" />
      <SkCard body="table" rows={10} size="xl" />
    </PageSkeleton>
  );
}

export function OperationsSkeleton() {
  return (
    <PageSkeleton label="Operations">
      <SkHeader />
      <SkRoute stops={[{ now: true, sub: true }, { sub: true }]} />
      <SkKpis />
      <SkSplit>
        <SkCard body="table" rows={10} size="xl" />
        <SkCard body="lines" rows={14} size="xl" />
      </SkSplit>
      <SkSplit>
        <SkCard body="bars" rows={7} size="lg" />
        <SkCard body="lines" rows={10} size="lg" />
      </SkSplit>
      <SkMarginTrends />
      {/* Watch List: สูงตามจำนวนหน่วยที่หลุดเกณฑ์ — ใช้ความสูงที่พบบ่อย */}
      <SkCard body="table" rows={8} size="xl" height="h-[556px]" />
    </PageSkeleton>
  );
}

/**
 * การ์ดแนวโน้ม Margin (operations/margin-trends.tsx): ไม่มีขนาดคงที่ สูงตามจำนวนกราฟเล็ก
 * จึงจำลองโครงเดียวกัน — หัวการ์ด + ตารางกราฟ 2/3 คอลัมน์ ช่องละ caption + กราฟสัดส่วน 320:132 — ความสูงตามความกว้างจอเหมือนของจริง
 */
// จำนวนกราฟที่พบบ่อย (หน่วยที่มีรายได้) — จำนวนจริงต่างจากนี้ การ์ดจะต่างกันทีละแถวกราฟ
const MARGIN_UNITS = 9;

function SkMarginTrends() {
  return (
    <div className="card">
      {/* สูงเท่าหัวการ์ดจริง (ชื่อ + คำอธิบาย) */}
      <div className="mb-3 flex h-[2.83rem] flex-col justify-center gap-2">
        <Bone className="h-4 w-48" />
        <Bone className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: MARGIN_UNITS }, (_, i) => (
          <div key={i} className="border-t border-line pt-3 pb-2">
            <div className="mb-1 flex h-[1.3rem] items-center justify-between gap-3">
              <Bone className="h-3.5 w-28" />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="aspect-[320/132] h-auto w-full rounded-[14px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UploadSkeleton() {
  return (
    <PageSkeleton label="หน้านำเข้าข้อมูล">
      <SkHeader actions={0} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Bone className="h-4 w-36" />
            <Bone className="h-7 w-72 max-w-full rounded-full" />
          </div>
          <Bone className="h-[12.5rem] w-full rounded-[14px]" />
        </div>
        <div className="card space-y-2.5">
          <Bone className="h-4 w-28" />
          <Bone className="mt-3 h-4 w-56 max-w-full" />
          <Bone className="h-3 w-40" />
          <Bone className="mt-4 h-16 w-full" />
        </div>
      </div>
      <SkCard body="table" rows={5} />
    </PageSkeleton>
  );
}

/**
 * key ของ <Suspense> ในหน้า: เปลี่ยนค่าเมื่อ search params เปลี่ยน → React แสดง skeleton ใหม่
 * `ignore` = พารามิเตอร์ที่ไม่ต้องโชว์ skeleton ทั้งหน้า (เช่น คลิกดูรายละเอียดสาขา ที่ต้องเลื่อนไปยัง #anchor)
 */
export function paramsKey(sp: Record<string, string | string[] | undefined>, ignore: string[] = []) {
  return Object.entries(sp)
    .filter(([k]) => !ignore.includes(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
}
