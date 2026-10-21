"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * ข้อความแจ้งลอยมุมล่างขวาของจอ — ใช้แทนข้อความ error ใต้ปุ่ม ที่ดันแถว/การ์ดให้สูงขึ้น
 * หายเองใน 6 วินาที หรือกดปิด · message = null ไม่แสดง
 */
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  // ข้อความเกิดหลังผู้ใช้กดเท่านั้น (ฝั่งเบราว์เซอร์) — ตอน render ฝั่งเซิร์ฟเวอร์ message เป็น null เสมอ จึงใช้ document ได้
  if (!message) return null;
  return createPortal(
    <div
      role="alert"
      className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2.5 rounded-[20px] bg-surface px-4 py-3 text-sm text-loss-text shadow-(--shadow-pop)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={onClose} aria-label="ปิดข้อความ" className="-m-1 rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0 animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
