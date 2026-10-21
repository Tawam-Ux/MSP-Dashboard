"use client";

import { useLayoutEffect, useRef } from "react";

// เวลาที่ skeleton ตัวก่อนหน้าถูกถอดออก
let lastUnmount = -Infinity;

/**
 * ตอนเปลี่ยนเมนู skeleton ถูก mount สองรอบติดกัน (loading.tsx → fallback ของ <Suspense> ในหน้า)
 * ถ้าไม่จัดการ อนิเมชันจางเข้าจะเริ่มใหม่ → หน้าวูบหายแล้วกลับมา
 * - ถ้าเพิ่งมี skeleton ตัวก่อนหน้า ข้ามการจางเข้า (skel-in) แสดงเต็มทันที
 * ทำใน layout effect จึงเสร็จก่อนเฟรมแรกถูกวาด
 */
export function SkeletonSync() {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (!root || typeof root.getAnimations !== "function") return;
    const replacing = performance.now() - lastUnmount < 500;
    for (const a of root.getAnimations({ subtree: true })) {
      if (a instanceof CSSAnimation && a.animationName === "skel-in" && replacing) a.finish();
    }
    return () => {
      lastUnmount = performance.now();
    };
  }, []);

  return <span ref={ref} hidden />;
}
