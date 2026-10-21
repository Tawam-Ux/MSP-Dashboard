"use client";

import type { ReactNode } from "react";
import { pathOf, useNavPending } from "./nav-pending";
import { OperationsSkeleton, OverviewSkeleton, PnlSkeleton, UploadSkeleton, ZonesSkeleton } from "./skeleton";

/** skeleton ของแต่ละเมนู — ตัวเดียวกับ loading.tsx ของหน้านั้น (หน้าที่ไม่มีของตัวเองใช้ของหน้าภาพรวม เหมือน (app)/loading.tsx) */
/** skeleton ของหน้าตาม path (ใช้ทั้งที่นี่และ (app)/loading.tsx) */
export function skeletonFor(path: string): ReactNode {
  switch (path) {
    case "/pnl": return <PnlSkeleton />;
    case "/zones": return <ZonesSkeleton />;
    case "/operations": return <OperationsSkeleton />;
    case "/upload": return <UploadSkeleton />;
    default: return <OverviewSkeleton />;
  }
}

/**
 * พื้นที่เนื้อหาหลักของหน้าแอป
 * กดลิงก์ที่เป็น PendingLink (เมนู ปุ่มปิดรายละเอียดสาขา ฯลฯ) แล้วแสดง skeleton ของหน้าปลายทางทันทีระหว่างรอเซิร์ฟเวอร์ตอบ — เนื้อหาเดิมแค่ซ่อนด้วย CSS ([data-nav-pending])
 * ไม่ห่อ children ด้วย element อื่น: CSS ของหน้า (.page-host > div > *) และ skeleton อ้างโครงนี้อยู่
 */
export function TabPane({ children }: { children: ReactNode }) {
  const { trip } = useNavPending();
  const skeleton = trip ? skeletonFor(pathOf(trip.to)) : null;
  return (
    <div className="page-host min-w-0" data-nav-pending={trip ? "" : undefined}>
      {/* <section> ไม่ใช่ <div>: CSS ทยอยเข้าของหน้า (.page-host > div:not(.skel-page) > *) ไม่จับ skeleton นี้ */}
      {skeleton && (
        <section data-nav-skeleton className="contents">
          {skeleton}
        </section>
      )}
      {children}
    </div>
  );
}
