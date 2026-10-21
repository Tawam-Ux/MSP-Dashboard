"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Option = { code: string; name: string };

/**
 * ตัวกรองสาขาแบบ Excel: ช่องค้นหา · (เลือกทั้งหมด) · ติ๊กทีละสาขา · ตกลง/ยกเลิก
 * เก็บผลใน URL (?branch=code1,code2) — selected = null หมายถึงทุกสาขา
 * พิมพ์ค้นหา (เหมือน Excel): สาขาที่ค้นเจอถูกติ๊กทั้งหมดอัตโนมัติ · ตกลง = กรองเฉพาะที่ติ๊กในผลค้นหา (แทนตัวกรองเดิม)
 * ติ๊ก "เพิ่มรายการที่เลือกลงในตัวกรองเดิม" = รวมกับสาขาที่กรองไว้ก่อนหน้า · Enter ในช่องค้นหา = ตกลง
 */
export function BranchFilter({ branches, selected }: { branches: Option[]; selected: string[] | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected ?? branches.map((b) => b.code)));
  // ระหว่างค้นหา: การติ๊กของผลค้นหา (แยกจาก draft) · addToCurrent = รวมกับตัวกรองเดิม
  const [searchDraft, setSearchDraft] = useState<Set<string>>(new Set());
  // ยังไม่ได้แตะการติ๊กของผลค้นหา (ยังเป็นการติ๊กทั้งหมดอัตโนมัติ)
  const [searchUntouched, setSearchUntouched] = useState(true);
  const [addToCurrent, setAddToCurrent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matchesOf = (text: string) => {
    const q = text.trim().toLowerCase();
    return q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
  };
  // พิมพ์ค้นหาใหม่ = ติ๊กผลค้นหาทั้งหมดใหม่ (Excel เริ่มจากเลือกผลค้นหาทั้งหมดเสมอ)
  const search = (text: string) => {
    setQuery(text);
    setSearchDraft(new Set(matchesOf(text).map((b) => b.code)));
    setSearchUntouched(true);
  };

  const reset = () => {
    setDraft(new Set(selected ?? branches.map((b) => b.code)));
    setQuery("");
    setAddToCurrent(false);
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  // คลิกนอกกล่อง / กด Esc = ยกเลิก (เหมือน Excel)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
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

  const searching = query.trim() !== "";
  const visible = matchesOf(query);
  // ค้นหาอยู่ = ใช้การติ๊กของผลค้นหา · ไม่ค้นหา = ใช้การติ๊กปกติ
  const checks = searching ? searchDraft : draft;
  const setChecks = searching ? setSearchDraft : setDraft;
  const checkedVisible = visible.filter((b) => checks.has(b.code)).length;
  const allChecked = visible.length > 0 && checkedVisible === visible.length;
  const someChecked = checkedVisible > 0 && !allChecked;

  const toggle = (code: string) => {
    // คลิกสาขาครั้งแรกหลังพิมพ์ค้นหา (ผลค้นหายังถูกติ๊กอัตโนมัติทั้งหมด) = เลือกเฉพาะสาขานั้น
    // ไม่งั้นคลิกเพื่อ "เลือก" จะกลายเป็นเอาติ๊กออก (ผู้ใช้ส่วนใหญ่คลิกสาขาที่ต้องการหลังค้นหา)
    if (searching && searchUntouched) {
      setSearchUntouched(false);
      setSearchDraft(new Set([code]));
      return;
    }
    if (searching) setSearchUntouched(false);
    const next = new Set(checks);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setChecks(next);
  };
  // (เลือกทั้งหมด) / (เลือกผลการค้นหาทั้งหมด) มีผลกับรายการที่เห็นเท่านั้น — ตรงกับ Excel
  const toggleAll = () => {
    if (searching) setSearchUntouched(false);
    const next = new Set(checks);
    for (const b of visible) {
      if (allChecked) next.delete(b.code);
      else next.add(b.code);
    }
    setChecks(next);
  };

  // สาขาที่จะกรองเมื่อกดตกลง
  const result = (): Set<string> => {
    if (!searching) return draft;
    const picked = new Set(visible.filter((b) => searchDraft.has(b.code)).map((b) => b.code));
    if (addToCurrent) for (const code of selected ?? branches.map((b) => b.code)) picked.add(code);
    return picked;
  };
  const canApply = result().size > 0;

  const apply = () => {
    const chosen = result();
    if (chosen.size === 0) return;
    const next = new URLSearchParams(params);
    const codes = branches.filter((b) => chosen.has(b.code)).map((b) => b.code);
    if (codes.length === branches.length) next.delete("branch");
    else next.set("branch", codes.join(","));
    next.delete("unit");
    setOpen(false);
    setQuery("");
    setAddToCurrent(false);
    setDraft(chosen);
    router.push(`${pathname}?${next}`, { scroll: false });
  };

  // ล้างตัวกรอง (เหมือน "Clear Filter From" ของ Excel): กลับเป็นทุกสาขาทันที ไม่ต้องกดตกลง
  const clearFilter = () => {
    const next = new URLSearchParams(params);
    next.delete("branch");
    next.delete("unit");
    setOpen(false);
    setQuery("");
    setAddToCurrent(false);
    setDraft(new Set(branches.map((b) => b.code)));
    router.push(`${pathname}?${next}`, { scroll: false });
  };

  const count = selected?.length ?? branches.length;
  const label = selected == null ? "ทุกสาขา" : count === 1 ? branches.find((b) => b.code === selected[0])?.name ?? "1 สาขา" : `${count} จาก ${branches.length} สาขา`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-(--shadow) ${
          selected ? "bg-brand-soft text-brand" : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
        </svg>
        {/* กว้างคงที่: เปลี่ยนสาขาที่เลือกแล้วปุ่ม (และแถวหัวหน้า) ไม่ย่อหดขยาย */}
        <span className="w-44 truncate text-left" title={`สาขา: ${label}`}>สาขา: {label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="กรองสาขา"
          className="pop-in absolute top-full left-1/2 z-30 mt-2 w-72 -translate-x-1/2 rounded-[24px] bg-surface p-3 shadow-(--shadow-pop)"
        >
          <button
            type="button"
            onClick={clearFilter}
            disabled={selected == null}
            className="-mx-1 mb-2 flex w-[calc(100%+0.5rem)] items-center gap-2.5 rounded-full px-2.5 py-1.5 text-left text-sm font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            {/* กรวยกรองมีกากบาทแดง — ตอนไม่มีตัวกรองเป็นสีจางทั้งไอคอน */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M3 4h15l-5.5 7v6l-4 2v-8z" stroke="currentColor" />
              <path d="M16 15l5 5M21 15l-5 5" stroke={selected == null ? "currentColor" : "var(--loss)"} />
            </svg>
            ล้างตัวกรองสาขา
          </button>
          <div className="-mx-3 mb-3 border-t border-line" />
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            // Enter = ตกลง (เหมือน Excel)
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="ค้นหาสาขา"
            aria-controls={listId}
            autoFocus
            className="field min-h-10! py-1.5! text-sm"
          />
          <ul id={listId} className="mt-2 max-h-64 scroll-y overflow-y-auto rounded-[18px] bg-surface-2 p-1 text-sm">
            <li>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-1.5 font-semibold hover:bg-surface">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  disabled={visible.length === 0}
                />
                {searching ? "(เลือกผลการค้นหาทั้งหมด)" : "(เลือกทั้งหมด)"}
              </label>
            </li>
            {/* Excel: "Add current selection to filter" — แสดงเฉพาะตอนค้นหา */}
            {searching && (
              <li>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-1.5 hover:bg-surface">
                  <input type="checkbox" checked={addToCurrent} onChange={(e) => setAddToCurrent(e.target.checked)} />
                  เพิ่มรายการที่เลือกลงในตัวกรองเดิม
                </label>
              </li>
            )}
            {visible.map((b) => (
              <li key={b.code}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-1.5 hover:bg-surface">
                  <input type="checkbox" checked={checks.has(b.code)} onChange={() => toggle(b.code)} />
                  <span className="truncate">{b.name}</span>
                </label>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-2 text-ink-3">ไม่พบสาขาที่ค้นหา</li>}
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={close} className="btn-soft min-h-9 px-4! text-sm!">
              ยกเลิก
            </button>
            <button type="button" onClick={apply} disabled={!canApply} className="btn-primary min-h-9! px-5! py-1.5! text-sm">
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
