"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const POP_WIDTH = 272;

export type ConfirmState = { status: "idle" } | { status: "error"; message: string };

type Pos = { top?: number; bottom?: number; right: number; above: boolean };

/**
 * ปุ่มที่ต้องยืนยันก่อนทำ — กดแล้วกล่องยืนยันเล็กๆ เด้งขึ้นข้างปุ่ม (ลอยเหนือหน้า ไม่ดันการ์ด/ตารางให้ยืดหด)
 * ปิดได้ด้วยปุ่มยกเลิก คลิกนอกกล่อง Esc เลื่อนหน้า หรือเปลี่ยนขนาดจอ · children = เนื้อหาในกล่อง (และช่องในฟอร์มได้)
 */
export function ConfirmPopButton({ label, confirmLabel, ariaLabel, action, hidden, children }: {
  label: string;
  confirmLabel: string;
  ariaLabel: string;
  action: (prev: ConfirmState, formData: FormData) => Promise<ConfirmState>;
  hidden?: Record<string, string | number>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(action, { status: "idle" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null); // null = ไม่ได้แสดง

  // เปิด: render ครั้งเดียวพร้อมตำแหน่ง
  const open = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    // วางใต้ปุ่ม ชิดขวา · ถ้าใกล้ขอบล่างของจอ วางเหนือปุ่มแทน
    const above = r.bottom + 170 > window.innerHeight;
    const right = Math.max(8, window.innerWidth - r.right);
    setPos(above ? { bottom: window.innerHeight - r.top + 6, right, above } : { top: r.bottom + 6, right, above });
  };

  const close = () => setPos(null);

  // ปิดเมื่อคลิกนอกกล่อง กด Esc เลื่อนหน้า หรือเปลี่ยนขนาดจอ (กล่องลอยตามตำแหน่งปุ่มตอนเปิด)
  useEffect(() => {
    if (!pos || pending) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos, pending]);

  const shown = !!pos;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (shown ? close() : open())}
        aria-expanded={shown}
        className={`btn-soft min-h-8 px-3! text-xs! ${
          shown ? "bg-loss-soft! text-loss-text!" : "hover:bg-loss-soft! hover:text-loss-text!"
        }`}
      >
        {label}
      </button>

      {pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right, width: POP_WIDTH }}
            className="pop-in fixed z-50 rounded-[20px] bg-surface p-3.5 text-left text-xs shadow-(--shadow-pop)"
          >
            <form action={formAction}>
              {Object.entries(hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
              {children}
              {state.status === "error" && <p role="alert" className="mt-1.5 text-loss-text">{state.message}</p>}
              <div className="mt-2.5 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="btn-soft min-h-8 px-3.5! text-xs!"
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={pending} className="min-h-8 rounded-full bg-loss px-3.5 py-1 font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {/* ข้อความสองแบบซ้อนกัน ปุ่มกว้างเท่าเดิมทั้งก่อนและระหว่างลบ */}
                  <span className="swap">
                    <span data-on={!pending || undefined}>{confirmLabel}</span>
                    <span data-on={pending || undefined}>กำลังลบ…</span>
                  </span>
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
