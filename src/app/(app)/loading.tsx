"use client";

import { usePathname } from "next/navigation";
import { skeletonFor } from "@/frontend/components/tab-pane";

// loading ของกลุ่ม (app): ตอนเปลี่ยนเมนู Next แสดงตัวนี้ก่อน (ยังไม่รู้จัก loading.tsx ของหน้าปลายทาง) แล้วค่อยเป็นของหน้านั้น
// จึงต้องแสดง skeleton ของหน้าปลายทางตาม path — ถ้าเป็น skeleton ภาพรวมตายตัว จะสลับโครงแวบหนึ่ง (กะพริบ) ระหว่างทาง
export default function Loading() {
  return skeletonFor(usePathname());
}
