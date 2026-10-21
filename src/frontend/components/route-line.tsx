import Link from "next/link";
import { PendingLink } from "./nav-pending";

export type Stop = {
  label: string;
  /** บรรทัดเล็กใต้ชื่อ เช่น จำนวนหน่วยย่อย */
  sub?: string;
  /** สถานีที่ผ่านมาแล้วกดย้อนกลับได้ */
  href?: string;
  /** กดแล้วขึ้น skeleton ของหน้าทันที (ใช้กับสถานีที่พาออกจากหน้ารายละเอียดสาขา/หน่วย) */
  instant?: boolean;
  state: "past" | "now" | "next";
};

/**
 * เส้นทางในผังหน่วย: สถานีบนเส้นหนา — ช่วงที่ผ่านมาเป็นแดง MSP, สถานีปัจจุบันใหญ่ขึ้น, สถานีถัดไปเป็นเทา
 * สถานีที่มี href เป็นลิงก์กลับขึ้นไปในผัง (เก็บงวด/ตัวเลือกอื่นไว้ตามลิงก์ที่ส่งมา)
 */
export function RouteLine({ stops, label = "ตำแหน่งในผังหน่วย" }: { stops: Stop[]; label?: string }) {
  return (
    <nav aria-label={label} className="route">
      <ol className="route-list">
        {stops.map((s, i) => {
          const body = (
            <>
              <span className="stop-dot" aria-hidden />
              <span className="stop-label" title={s.label}>{s.label}</span>
              {s.sub && <span className="stop-sub num">{s.sub}</span>}
            </>
          );
          return (
            <li key={`${i}-${s.label}`} className="stop" data-state={s.state} style={{ "--i": i } as React.CSSProperties}>
              {s.href && s.state !== "now" ? (
                s.instant ? (
                  <PendingLink href={s.href} scroll={false} className="stop-link">{body}</PendingLink>
                ) : (
                  <Link href={s.href} scroll={false} className="stop-link">{body}</Link>
                )
              ) : (
                <span className="stop-link" aria-current={s.state === "now" ? "location" : undefined}>{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
