"use client";

import { useEffect } from "react";

/** กล่องที่อาจเลื่อนได้ในตัว: เนื้อหาการ์ด (.card-body) และกล่องอื่นที่ติดคลาส .scroll-y */
const SELECTOR = ".card-body, .scroll-y";

/**
 * แยกกล่องที่ "เลื่อนได้จริง" ออกจากกล่องที่เนื้อหาสั้นไม่ล้น
 * - เนื้อหาล้น → ติด data-overflow → CSS ใส่ overscroll-behavior: contain (เลื่อนจนสุดแล้วทั้งหน้าไม่เลื่อนตาม)
 * - เนื้อหาไม่ล้น → ไม่ติด → ล้อเมาส์เลื่อนทั้งหน้าตามปกติ
 * ตรวจตอนเมาส์เข้ากล่อง (ก่อนหมุนล้อ) และทุกครั้งที่หมุนล้อ เผื่อเนื้อหาเปลี่ยนระหว่างชี้ เช่น พิมพ์ค้นหาในตัวกรองสาขา
 */
export function ScrollContain() {
  useEffect(() => {
    const mark = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(SELECTOR) : null;
      if (el) el.toggleAttribute("data-overflow", el.scrollHeight > el.clientHeight + 1);
    };
    document.addEventListener("mouseover", mark, { passive: true });
    document.addEventListener("wheel", mark, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mouseover", mark);
      document.removeEventListener("wheel", mark, { capture: true });
    };
  }, []);

  return null;
}
