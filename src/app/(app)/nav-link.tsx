"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PendingLink, isActivePath, pathOf, useNavPending } from "@/frontend/components/nav-pending";

/**
 * จำตัวกรองของแต่ละหน้า (query ใน URL เช่น ?period=…&zone=…) ไว้ตลอด session ของแท็บเบราว์เซอร์ (sessionStorage)
 * แยกเป็นของหน้าใครหน้ามัน: กดเมนูกลับไปหน้าเดิม = ได้ตัวกรองล่าสุดของหน้านั้น · หน้าที่ยังไม่เคยกรอง = ค่าเริ่มต้นของหน้า (ไม่รับตัวกรองจากหน้าอื่น)
 * เบราว์เซอร์บล็อก storage → ทำงานแบบเดิม (ลิงก์ไม่มี query)
 */
const FILTERS_KEY = "msp:page-filters";

const FILTERS_EVENT = "msp:page-filters";

function readRaw(): string {
  try {
    return sessionStorage.getItem(FILTERS_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function parseFilters(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(FILTERS_EVENT, onChange);
  return () => window.removeEventListener(FILTERS_EVENT, onChange);
};

function useRememberedHrefs(hrefs: string[]) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // เซิร์ฟเวอร์/ก่อน hydrate = ยังไม่รู้ตัวกรองที่จำไว้ (ลิงก์ไม่มี query) แล้วค่อยอัปเดตหลัง hydrate
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  const saved = useMemo(() => parseFilters(raw), [raw]);

  // บันทึก query ของหน้าที่เปิดอยู่ (เฉพาะหน้าที่อยู่ในเมนู) ทุกครั้งที่ตัวกรองเปลี่ยน
  useEffect(() => {
    if (!hrefs.includes(pathname)) return;
    const all = parseFilters(readRaw());
    if (all[pathname] === search) return;
    all[pathname] = search;
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(all));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(FILTERS_EVENT));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hrefs มาจาก layout คงที่ตลอด
  }, [pathname, search]);

  return (href: string) => {
    const q = href.startsWith("/") ? saved[href] : undefined;
    return q ? `${href}?${q}` : href;
  };
}

/**
 * แท็บเม็ดยาบนแถบบน — แท็บของหน้าที่เปิดอยู่เป็นพื้นหมึกเข้ม
 * พื้นเม็ดยาเป็นชิ้นเดียว (.tab-pill) ที่เลื่อนและยืดหดไปหาแท็บที่กด แทนการสลับพื้นทันที
 * กดแล้วแท็บนั้น active ทันทีและพื้นที่เนื้อหาเป็น skeleton ของหน้านั้น (nav-pending.tsx) ไม่ต้องรอเซิร์ฟเวอร์ตอบ
 * ก่อน JS ทำงาน (และถ้าวัดตำแหน่งไม่ได้) แท็บ active ยังมีพื้นของตัวเองตาม CSS เดิม
 */
export function NavTabs({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const { trip } = useNavPending();
  const current = trip ? pathOf(trip.to) : pathname;
  const activeIndex = links.findIndex((l) => isActivePath(l.href, current));
  const hrefFor = useRememberedHrefs(links.map((l) => l.href));

  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = (animate: boolean) => {
      const tab = activeIndex >= 0 ? (nav.querySelectorAll<HTMLElement>(".tab")[activeIndex] ?? null) : null;
      if (!tab) return setPill(null);
      setPill((prev) => ({ x: tab.offsetLeft, y: tab.offsetTop, w: tab.offsetWidth, h: tab.offsetHeight, animate: animate && prev !== null }));
      // จอแคบ (แท็บเลื่อนแนวนอน): เลื่อนให้แท็บที่เลือกอยู่ในจอ
      if (nav.scrollWidth > nav.clientWidth) {
        const left = tab.offsetLeft - nav.scrollLeft;
        if (left < 0 || left + tab.offsetWidth > nav.clientWidth) {
          nav.scrollTo({ left: tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2, behavior: animate ? "smooth" : "auto" });
        }
      }
    };
    measure(true);
    // ฟอนต์โหลดเสร็จ / เปลี่ยนขนาดจอ → ความกว้างแท็บเปลี่ยน วางเม็ดยาใหม่โดยไม่เลื่อน
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeIndex]);

  return (
    <nav ref={navRef} aria-label="เมนูหลัก" className="tabs" data-pill={pill ? "" : undefined}>
      {pill && (
        <span
          aria-hidden
          className="tab-pill"
          data-animate={pill.animate || undefined}
          style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }}
        />
      )}
      {links.map((l, i) => (
        <PendingLink key={l.href} href={hrefFor(l.href)}aria-current={i === activeIndex ? "page" : undefined} className="tab">
          {l.label}
        </PendingLink>
      ))}
    </nav>
  );
}
