"use client";

import { useEffect, useRef, useState } from "react";
import { MONTHS_SHORT } from "@/backend/lib/format";
import { Icon } from "./icons";
import { useMoney } from "./money";

// ฟีเจอร์ "รายละเอียดรายการในงบ" — ถอดออกได้: node scripts/account-detail-feature.mjs remove (ดู src/backend/lib/account-detail.ts)

/** ข้อมูลที่ตอบจาก /api/account-detail (ตรงกับ AccountDetail ใน src/backend/lib/account-detail.ts) */
type Detail = {
  rows: { account: string; name: string; amount: number }[];
  total: number;
  sheets: string[];
  missing: string[];
  fileName: string;
};

/**
 * ชื่อชีตแบบย่อ: เดือนติดกันรวมเป็นช่วง — MASTER_ม.ค. … MASTER_ธ.ค. → MASTER_ม.ค.–ธ.ค. · เว้นเดือน → MASTER_ม.ค.–มี.ค., มิ.ย.
 * ชื่อที่ไม่ใช่ MASTER_<เดือน> แสดงตามเดิม
 */
function sheetsLabel(sheets: string[]): string {
  const months = sheets.map((s) => MONTHS_SHORT.indexOf(s.replace(/^MASTER_/, "")));
  if (sheets.length < 2 || months.some((m, i) => m < 0 || !sheets[i].startsWith("MASTER_"))) return sheets.join(", ");
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(j > i ? `${MONTHS_SHORT[sorted[i]]}–${MONTHS_SHORT[sorted[j]]}` : MONTHS_SHORT[sorted[i]]);
    i = j + 1;
  }
  return `MASTER_${runs.join(", ")}`;
}

type Picked = { group: string; name: string; value: number };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "done"; data: Detail };

export type AccountDetailSource = { unit: string; unitName: string; periods: string[]; periodLabel: string };

/** ปุ่มชื่อรายการในงบ — StatementTable (server) ใส่ data-* ชื่อเดียวกันนี้ไว้ แล้ว AccountDetailScope จับคลิกจากกรอบนอก */
const ACCOUNT_ATTR = "data-account-group";

// ผลที่โหลดแล้วต่อ URL — เปิดรายการเดิมซ้ำไม่ต้องรออ่านไฟล์อีก (ล้างเมื่อรีเฟรชหน้า)
const loaded = new Map<string, Detail>();

/**
 * กรอบรอบการ์ดงบกำไรขาดทุน: กดชื่อรายการ (เช่น รายได้จากการขาย) → ป๊อปอัปแสดงบัญชีย่อยจากชีต MASTER_<เดือน>
 * ของไฟล์ Master ที่ใช้อยู่ กรองด้วย Group ของรายการ + รหัสสาขา · ใช้ <dialog> (โฟกัสอยู่ในกล่อง กด Esc ปิดได้)
 */
export function AccountDetailScope({ source, children }: { source: AccountDetailSource; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  // ข้อผิดพลาดต่อ URL (ผลที่สำเร็จเก็บใน loaded) · attempt = กด "ลองใหม่"
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setDone] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const url = picked
    ? `/api/account-detail?${new URLSearchParams({ unit: source.unit, group: picked.group, periods: source.periods.join(",") })}`
    : null;
  const hit = url ? loaded.get(url) : undefined;
  const load: Load = hit ? { status: "done", data: hit } : url && errors[url] ? { status: "error", message: errors[url] } : { status: "loading" };

  useEffect(() => {
    if (!url || loaded.has(url)) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message ?? `โหลดไม่สำเร็จ (HTTP ${res.status})`);
        loaded.set(url, body as Detail);
        setDone((n) => n + 1);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setErrors((m) => ({ ...m, [url]: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" }));
      });
    return () => ctrl.abort();
  }, [url, attempt]);

  // ล็อกการเลื่อนหน้าหลังป๊อปอัประหว่างเปิด: <dialog> ไม่ล็อกให้เอง — หมุนล้อบนพื้นหลัง หรือเลื่อนรายการจนสุดแล้วหน้าด้านหลังเลื่อนตาม
  // แถบเลื่อนของหน้าหายตอนล็อก → จองที่ไว้ (scrollbar-gutter) เนื้อหาด้านหลังจึงไม่ขยับซ้ายขวา
  const isOpen = picked !== null;
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = "stable";
    html.style.overflow = "hidden";

    // กันชั้นที่สอง: บางเบราว์เซอร์/ทัชแพดยังส่งการเลื่อนจากตัวป๊อปอัปไปถึงหน้าด้านหลัง
    // ยอมให้เลื่อนเฉพาะกล่องในป๊อปอัปที่ยังเลื่อนต่อในทิศนั้นได้ — นอกนั้นยกเลิกทั้งหมด
    const canScroll = (target: EventTarget | null, dy: number) => {
      const dialog = dialogRef.current;
      for (let el = target instanceof Element ? target : null; el && el !== dialog && dialog?.contains(el); el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY !== "auto" && overflowY !== "scroll") || el.scrollHeight <= el.clientHeight) continue;
        if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
      return false;
    };
    const onWheel = (e: WheelEvent) => {
      if (!canScroll(e.target, e.deltaY)) e.preventDefault();
    };
    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? lastY;
      // นิ้วลากขึ้น = เลื่อนเนื้อหาลง
      if (!canScroll(e.target, lastY - y)) e.preventDefault();
      lastY = y;
    };
    const opts = { passive: false, capture: true } as const;
    document.addEventListener("wheel", onWheel, opts);
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, opts);
    return () => {
      html.style.overflow = prev.overflow;
      html.style.scrollbarGutter = prev.gutter;
      document.removeEventListener("wheel", onWheel, opts);
      document.removeEventListener("touchstart", onTouchStart, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, opts);
    };
  }, [isOpen]);

  const retry = () => {
    if (!url) return;
    setErrors((m) => {
      const next = { ...m };
      delete next[url];
      return next;
    });
    setAttempt((n) => n + 1);
  };

  const onClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(`[${ACCOUNT_ATTR}]`);
    if (!btn) return;
    setPicked({ group: btn.getAttribute(ACCOUNT_ATTR)!, name: btn.dataset.accountName ?? "", value: Number(btn.dataset.accountValue ?? 0) });
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  return (
    <div onClick={onClick} className="contents">
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="account-detail-title"
        // ปิดแล้วเปิดรายการที่เคยผิดพลาดอีกครั้ง = โหลดใหม่
        onClose={() => { setPicked(null); setErrors({}); }}
        // คลิกพื้นหลังนอกกล่อง = ปิด (target เป็นตัว dialog เองเมื่อคลิกที่ ::backdrop)
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100dvh-2rem))] overflow-hidden bg-surface p-0 text-ink shadow-(--shadow-pop) backdrop:bg-[rgb(15_18_26/0.42)]"
        // inline: ชนะกฎ :focus-visible ใน globals.css (นอก layer, border-radius 999px) ที่ทำให้กล่องกลายเป็นวงรีตอนตัว dialog ได้โฟกัส
        // โฟกัสจริงย้ายไปปุ่มปิด (autoFocus) จึงไม่ต้องมีวงโฟกัสรอบกล่อง
        style={{ borderRadius: 28, outline: "none" }}
      >
        {picked && (
          <div className="pop-in flex max-h-[inherit] flex-col">
            <header className="flex items-start gap-3.5 px-6 pt-5.5 pb-4">
              <span aria-hidden className="roundel roundel-sm" style={{ "--line-c": "var(--navy)", color: "var(--surface)" } as React.CSSProperties}>
                {picked.group}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="account-detail-title" className="text-lg leading-snug font-semibold text-navy">{picked.name}</h2>
                <p className="mt-0.5 text-[0.8125rem] text-pretty text-ink-3">
                  {source.unitName} · {source.periodLabel}
                </p>
              </div>
              {/* showModal() เรียกก่อนเนื้อหา render → โฟกัสตกที่ตัว dialog · autoFocus ย้ายมาที่ปุ่มปิดเมื่อเนื้อหาขึ้น */}
              <button type="button" onClick={close} autoFocus aria-label="ปิดรายละเอียดรายการ" className="btn-soft size-10 shrink-0 p-0!">
                <Icon name="close" size={16} stroke={2.4} />
              </button>
            </header>

            <Body load={load} picked={picked} unit={source.unit} onRetry={retry} />
          </div>
        )}
      </dialog>
    </div>
  );
}

function Body({ load, picked, unit, onRetry }: { load: Load; picked: Picked; unit: string; onRetry: () => void }) {
  // ตัวเลขตามปุ่มรูปแบบตัวเลขบนหัวหน้า (ปกติ / ทศนิยม / ย่อ K/M)
  const { fmt } = useMoney();
  if (load.status === "loading") {
    return (
      <div className="space-y-3 px-6 pb-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">กำลังอ่านชีต MASTER_ จากไฟล์ Master…</span>
        {[72, 56, 64, 48, 60].map((w, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="skel h-3.5 w-14" />
            <span className="skel h-3.5" style={{ width: `${w}%` }} />
            <span className="skel ml-auto h-3.5 w-20" />
          </div>
        ))}
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div role="alert" className="mx-6 mb-6 flex items-center gap-3 rounded-[18px] bg-loss-soft px-4 py-3 text-sm text-loss-text">
        <Icon name="alert" size={18} />
        <span className="min-w-0 flex-1">{load.message}</span>
        <button type="button" onClick={onRetry} className="btn-soft min-h-9 shrink-0 px-3.5! text-xs!">ลองใหม่</button>
      </div>
    );
  }

  const { rows, total, sheets, missing, fileName } = load.data;
  const diff = total - picked.value;
  // งบเก็บยอดปัด 2 ตำแหน่ง · รวมหลายเดือนปัดทีละเดือน — คลาดได้ไม่เกินสตางค์ต่อเดือน
  const matches = Math.abs(diff) < 0.01 * Math.max(1, sheets.length) + 1e-6;
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r.amount)));

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-6 [scrollbar-gutter:stable]">
        {rows.length === 0 ? (
          <p className="rounded-[18px] bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
            ไม่พบบัญชีของ Group {picked.group} สาขา {unit} ที่มียอดใน {sheets.join(", ") || "ชีต MASTER_"}
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">บัญชีย่อยของ {picked.name} หน่วยเป็นบาท</caption>
            <thead>
              <tr className="text-left text-[0.8125rem] text-ink-2">
                <th scope="col" className="sticky top-0 z-1 hidden rounded-l-full bg-surface-2 py-2 pr-3 pl-3.5 font-medium whitespace-nowrap sm:table-cell">รหัสบัญชี</th>
                <th scope="col" className="sticky top-0 z-1 rounded-l-full bg-surface-2 py-2 pr-3 pl-3.5 font-medium sm:rounded-none sm:pl-3">ชื่อบัญชี</th>
                <th scope="col" className="sticky top-0 z-1 rounded-r-full bg-surface-2 py-2 pr-3.5 pl-3 text-right font-medium whitespace-nowrap">ยอด (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.account}|${r.name}`}>
                  <td className="num hidden border-b border-line py-2.5 pr-3 pl-3.5 align-top whitespace-nowrap text-ink-3 sm:table-cell">{r.account || "—"}</td>
                  <td className="border-b border-line py-2.5 pr-3 pl-3.5 sm:pl-3">
                    {/* จอแคบ: รหัสบัญชีอยู่เหนือชื่อ ให้ชื่อได้ความกว้างเต็ม */}
                    <span className="num block text-xs text-ink-3 sm:hidden">{r.account || "—"}</span>
                    <span className="block text-ink">{r.name || "(ไม่มีชื่อบัญชี)"}</span>
                    {/* สัดส่วนต่อยอดใหญ่สุด — เห็นทันทีว่าบัญชีไหนเป็นก้อนหลัก */}
                    <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full" style={{ width: `${(Math.abs(r.amount) / maxAbs) * 100}%`, background: r.amount < 0 ? "var(--loss)" : "var(--line-rev)" }} />
                    </span>
                  </td>
                  <td className={`num border-b border-line py-2.5 pr-3.5 pl-3 text-right align-top font-medium whitespace-nowrap ${r.amount < 0 ? "text-loss-text" : ""}`}>
                    {fmt(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="mt-3 border-t border-line px-6 pt-3.5 pb-5">
        {/* ยอดรวม + ผลตรวจยอดอยู่แถวเดียวกัน */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-sm text-ink-2">รวม {rows.length} บัญชี</span>
            {matches ? (
              <span className="badge badge-good text-xs"><Icon name="check" size={12} stroke={3} />ตรงกับยอดในงบ</span>
            ) : (
              <span className="badge badge-warn text-xs" title="ยอดในงบอาจปรับเครื่องหมาย (XW/XY) หรือใช้ยอดรวมตามไฟล์">
                <Icon name="alert" size={13} />ต่างจากยอดในงบ {fmt(diff)} บาท
              </span>
            )}
          </div>
          <span className={`num text-lg font-semibold ${total < 0 ? "text-loss-text" : "text-ink"}`}>{fmt(total)} <span className="text-[0.8125rem] font-normal text-ink-3">บาท</span></span>
        </div>
        {/* ที่มาของตัวเลข: บรรทัดเล็กใต้ยอดรวม ป้ายจาง + ค่าเข้ม แยกกันด้วยระยะ (ไม่ใช้กล่อง) · ชีตหลายเดือนย่อเป็นช่วง (รายชื่อเต็มใน title)
            ชื่อไฟล์ตัด … ถ้ายาวเกิน (ชื่อเต็มใน title) — ทั้งหมดไม่เกิน 2 บรรทัด */}
        <dl aria-label="ที่มาของข้อมูล" className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {[
            { label: "ชีต", value: sheetsLabel(sheets), title: sheets.length > 1 ? sheets.join(", ") : undefined },
            { label: "Group", value: picked.group },
            { label: "หน่วย", value: unit },
          ].map((s) => (
            <div key={s.label} className="flex min-w-0 items-baseline gap-1.5" title={s.title}>
              <dt className="shrink-0 text-ink-3">{s.label}</dt>
              <dd className="num min-w-0 font-medium text-ink-2">{s.value}</dd>
            </div>
          ))}
          <div className="flex min-w-0 max-w-full items-center gap-1.5" title={fileName}>
            <dt className="shrink-0 text-ink-3"><Icon name="file" size={13} /><span className="sr-only">ไฟล์</span></dt>
            <dd className="min-w-0 truncate text-ink-2">{fileName}</dd>
          </div>
        </dl>
        {missing.length > 0 && <p className="mt-2 text-xs text-(--warn-text)">ไม่มีชีต {missing.join(", ")} ในไฟล์ — ไม่ได้นับเดือนนั้น</p>}
      </footer>
    </>
  );
}
