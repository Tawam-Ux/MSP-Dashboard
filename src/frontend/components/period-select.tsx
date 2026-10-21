"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MONTHS_SHORT, formatPeriod, formatPeriods } from "@/backend/lib/format";

/**
 * ตัวเลือกงวด: ปุ่มเม็ดยา → ป๊อปปฏิทินรายปี (12 เดือนเป็นเม็ดยา 4×3) เลือกปีด้วยลูกศร
 * ติ๊กเดือนเดียวหรือหลายเดือน (ข้ามปีได้) หรือใช้ทางลัด ล่าสุด / ทั้งปี / ทุกเดือนที่มี แล้วกด "ดูข้อมูล" / "ดูรวม"
 * เก็บใน URL: ?period=2026-08-01 · ?period=2026-01-01,2026-02-01 · ?period=all
 * เดือนที่ไม่มีข้อมูลกดไม่ได้ · งวดล่าสุดมีจุดแดง · ลูกศรเลื่อนระหว่างเดือน · Esc ปิด
 * periods เรียงจากล่าสุดไปเก่าสุด (YYYY-MM-01) · value = งวดที่ดูอยู่ (เรียงเก่า → ใหม่)
 * fixed = ปุ่มกว้างคงที่ (ข้อความยาวตัดเป็น …) — ใช้เมื่อวางคู่กับตัวกรองอื่น ไม่ให้เปลี่ยนงวดแล้วปุ่มข้างๆ ขยับ
 * available = เดือนที่กดได้ (เช่น เฉพาะเดือนที่สาขาที่กรองไว้มีข้อมูล) — ไม่ส่ง = ทุกงวดใน periods
 * periods ยังเป็นงวดทั้งหมดของระบบ (ใช้ตัดสินว่าเลือกครบ = ?period=all)
 */
export function PeriodSelect({ periods, value, all = false, fixed = false, available: availableList }: {
  periods: string[]; value: string[]; all?: boolean; fixed?: boolean; available?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const last = value[value.length - 1];
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(last.slice(0, 4)));
  const [draft, setDraft] = useState<Set<string>>(() => new Set(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  // เดือนที่กดได้ เรียงล่าสุด → เก่าสุด (ว่าง = ไม่จำกัด)
  const usable = availableList?.length ? periods.filter((p) => availableList.includes(p)) : periods;
  const available = new Set(usable);
  const years = [...new Set(periods.map((p) => Number(p.slice(0, 4))))].sort((a, b) => a - b);
  const latest = usable[0];
  const yearIdx = years.indexOf(year);
  const key = (m: number) => `${year}-${String(m).padStart(2, "0")}-01`;
  const inYear = usable.filter((p) => Number(p.slice(0, 4)) === year);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const go = (list: string[]) => {
    setOpen(false);
    buttonRef.current?.focus();
    const sorted = [...list].sort();
    const param = sorted.length > 1 && sorted.length === periods.length ? "all" : sorted.join(",");
    if (param === (all ? "all" : value.join(","))) return;
    const next = new URLSearchParams(params);
    next.set("period", param);
    router.push(`${pathname}?${next}`);
  };

  const toggle = (period: string) => {
    const next = new Set(draft);
    if (next.has(period)) next.delete(period);
    else next.add(period);
    setDraft(next);
  };
  const yearAllOn = inYear.length > 0 && inYear.every((p) => draft.has(p));
  const toggleYear = () => {
    const next = new Set(draft);
    for (const p of inYear) {
      if (yearAllOn) next.delete(p);
      else next.add(p);
    }
    setDraft(next);
  };

  // เปิดแล้วโฟกัสเดือนที่เลือก (หรือเดือนแรกที่กดได้)
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], button:not(:disabled)')?.focus();
  }, [open]);

  // คลิกนอกกล่อง / Esc = ปิด
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  // ลูกศรเลื่อนโฟกัสในตาราง 4 คอลัมน์ ข้ามเดือนที่ไม่มีข้อมูล
  const onGridKey = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[e.key];
    if (!step) return;
    e.preventDefault();
    const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    let i = cells.indexOf(document.activeElement as HTMLButtonElement);
    for (let n = 0; n < 12; n++) {
      i += step;
      if (i < 0 || i >= cells.length) return;
      if (!cells[i].disabled) return cells[i].focus();
    }
  };

  const draftList = [...draft].sort();

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) return close();
          setYear(Number(last.slice(0, 4)));
          setDraft(new Set(value));
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        className="select inline-flex max-w-[22rem] items-center gap-2 bg-none! pr-3.5!"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-3">
          <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
        <span className="sr-only">งวด</span>
        <span className={`num truncate ${fixed ? "w-44 text-left" : ""}`} title={fixed ? formatPeriods(value, all) : undefined}>{formatPeriods(value, all)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id={popId} role="dialog" aria-label="เลือกงวด" className="pop-in absolute top-full left-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[24px] sm:right-0 sm:left-auto bg-surface p-3 shadow-(--shadow-pop)">
          {/* หัว: เปลี่ยนปี */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear(years[yearIdx - 1])}
              disabled={yearIdx <= 0}
              aria-label="ปีก่อนหน้า"
              className="icon-btn disabled:pointer-events-none disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span className="num text-[0.9375rem] font-semibold text-ink" aria-live="polite">ปี {year + 543}</span>
            <button
              type="button"
              onClick={() => setYear(years[yearIdx + 1])}
              disabled={yearIdx >= years.length - 1}
              aria-label="ปีถัดไป"
              className="icon-btn disabled:pointer-events-none disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>

          {/* 12 เดือน */}
          <div ref={gridRef} role="group" aria-label={`เดือนในปี ${year + 543}`} onKeyDown={onGridKey} className="grid grid-cols-4 gap-1.5">
            {MONTHS_SHORT.map((label, i) => {
              const period = key(i + 1);
              const has = available.has(period);
              const on = draft.has(period);
              return (
                <button
                  key={period}
                  type="button"
                  disabled={!has}
                  aria-pressed={on}
                  aria-label={`${formatPeriod(period)}${period === latest ? " (ล่าสุด)" : ""}${has ? "" : " ไม่มีข้อมูล"}`}
                  onClick={() => toggle(period)}
                  className={`month-cell ${on ? "bg-(--pill) font-semibold text-(--pill-fg)" : has ? "text-ink hover:bg-surface-2" : "text-ink-3/50"}`}
                >
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mr-1 inline align-[-1px]">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                  {label}
                  {period === latest && <span aria-hidden className={`absolute top-1.5 right-2 size-1.5 rounded-full ${on ? "bg-(--pill-fg)" : "bg-accent"}`} />}
                </button>
              );
            })}
          </div>

              {/* ทางลัด */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" onClick={toggleYear} disabled={inYear.length === 0} aria-pressed={yearAllOn} className={`btn-soft min-h-8 px-3! text-xs! ${yearAllOn ? "bg-brand-soft! text-brand!" : ""}`}>
                  ทั้งปี {year + 543}
                </button>
                <button type="button" onClick={() => setDraft(new Set([latest]))} className="btn-soft min-h-8 px-3! text-xs!">
                  ล่าสุด
                </button>
                <button type="button" onClick={() => setDraft(new Set(usable))} className="btn-soft min-h-8 px-3! text-xs!">
                  ทุกเดือนที่มี ({usable.length})
                </button>
                <button type="button" onClick={() => setDraft(new Set())} disabled={draft.size === 0} className="btn-soft min-h-8 px-3! text-xs! disabled:opacity-40">
                  ล้าง
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="num min-w-0 text-xs text-ink-3" aria-live="polite">
                  {draft.size === 0 ? "ยังไม่ได้เลือกเดือน" : <>เลือก <b className="font-semibold text-ink">{draft.size}</b> เดือน · {formatPeriods(draftList, draft.size === usable.length && draft.size > 1).replace(/ \(รวม \d+ เดือน\)$/, "")}</>}
                </span>
                <button type="button" onClick={() => go(draftList)} disabled={draft.size === 0} className="btn-primary min-h-9! shrink-0 px-4! py-1.5! text-sm">
                  {draft.size > 1 ? "ดูรวม" : "ดูข้อมูล"}
                </button>
              </div>
        </div>
      )}
    </div>
  );
}
