"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

// ไปหน้าที่ต้องการทันที: กดลิงก์แล้วพื้นที่เนื้อหาเป็น skeleton ของหน้าปลายทาง (tab-pane.tsx) ไม่ต้องรอเซิร์ฟเวอร์ตอบก่อน
// - เมนูบนแถบบน: เดิมหน้าเดิมค้างอยู่ 0.1–0.8 วินาที (นานกว่าตอนหน้ายังไม่ถูกคอมไพล์ใน dev)
// - ปิดรายละเอียดสาขา/หน่วย: เดิมหน้ารายละเอียดค้างจนหน้าหลักโหลดเสร็จ (Suspense ของหน้าไม่นับ ?unit= จึงไม่ขึ้น skeleton เอง)
// พอ URL เปลี่ยน หน้าปลายทาง (หรือ loading.tsx ที่เป็น skeleton ตัวเดียวกัน) รับช่วงต่อ
// จบการเดินทางเมื่อ: URL เปลี่ยน · Next บอกว่าการนำทางของลิงก์นั้นจบ/ถูกยกเลิก (useLinkStatus) · กดลิงก์ไปหน้าที่อยู่แล้ว
// ไม่งั้นการนำทางที่ถูกยกเลิก (เช่น กดเมนูอื่นแล้วรีบกดกลับหน้าเดิม URL ไม่เปลี่ยน) จะค้าง skeleton ไว้ทับเนื้อหาตลอด

/** from = URL ตอนกด (path + query) · to = ลิงก์ปลายทาง */
type Trip = { from: string; to: string };

const NavPendingContext = createContext<{ trip: Trip | null; start: (t: Trip) => void; end: (to?: string) => void; url: string }>({
  trip: null, start: () => {}, end: () => {}, url: "",
});

/** URL ในรูปเดียวกันสำหรับเทียบ: path + query เรียงคีย์ (กันกรณีเข้ารหัส/ลำดับพารามิเตอร์ต่างกันแต่เป็นหน้าเดียวกัน) */
function normalize(href: string): string {
  const [path, query = ""] = href.split("#")[0].split("?");
  const params = [...new URLSearchParams(query).entries()].sort(([a], [b]) => a.localeCompare(b));
  const q = new URLSearchParams(params).toString();
  return q ? `${path || "/"}?${q}` : path || "/";
}

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const url = normalize(query ? `${pathname}?${query}` : pathname);
  // URL เปลี่ยนแล้ว (ไปถึงปลายทาง ย้อนกลับ หรือไปหน้าอื่น) = จบการเดินทาง — คิดจากค่า ไม่ต้องล้าง state
  const active = trip && trip.from === url ? trip : null;
  const end = useCallback((to?: string) => setTrip((t) => (t && (to === undefined || t.to === to) ? null : t)), []);
  return <NavPendingContext.Provider value={{ trip: active, start: setTrip, end, url }}>{children}</NavPendingContext.Provider>;
}

export const useNavPending = () => useContext(NavPendingContext);

/** path ของลิงก์ (ตัด ?query และ #hash) */
export const pathOf = (href: string) => href.split(/[?#]/)[0] || "/";

/** แท็บของหน้าที่ path ตรงกัน */
export const isActivePath = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** อยู่ใน <Link>: การนำทางของลิงก์นี้จบหรือถูกยกเลิก (pending true → false) = จบการเดินทางไปลิงก์นี้ */
function TripWatch({ to }: { to: string }) {
  const { pending } = useLinkStatus();
  const { end } = useNavPending();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) end(to);
    was.current = pending;
  }, [pending, to, end]);
  return null;
}

/**
 * Link ที่กดแล้วขึ้น skeleton ของหน้าปลายทางทันที
 * ไม่นับเป็นการเดินทาง: เปิดแท็บใหม่ (Ctrl/⌘/Shift/คลิกกลาง) · ลิงก์ภายนอก · ลิงก์ไป URL ที่อยู่แล้ว (และล้างการเดินทางที่ค้างอยู่)
 */
export function PendingLink({ href, onClick, children, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { start, end, url } = useNavPending();
  const to = normalize(href);
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!href.startsWith("/")) return;
        if (to === url) return end();
        start({ from: url, to });
      }}
      {...rest}
    >
      {children}
      <TripWatch to={to} />
    </Link>
  );
}
