"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { login, type LoginState } from "./actions";

/**
 * ฟอร์มเข้าสู่ระบบในการ์ดใต้โคม (lamp-login.tsx) — ไม่มี autoFocus เพราะเปิดหน้ามาไฟยังปิด การ์ดซ่อนอยู่
 * โคมเป็นคนโฟกัสช่องให้ตอนเปิดไฟ · ล็อกอินไม่ผ่าน = แจ้งโคม (ไฟตกวูบ) แล้วโฟกัสช่องรหัสผ่านให้พิมพ์ใหม่
 */
export function LoginForm({ callbackUrl, onError }: { callbackUrl: string; onError?: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.error) return;
    onError?.();
    passwordRef.current?.focus();
  }, [state, onError]);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">ชื่อผู้ใช้</span>
        <input
          // key บังคับให้ค่าเริ่มต้นเปลี่ยนตามชื่อที่ส่งกลับมาหลังล็อกอินไม่ผ่าน
          key={state.username ?? ""}
          name="username"
          defaultValue={state.username}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="กรอกชื่อผู้ใช้"
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">รหัสผ่าน</span>
        <span className="relative block">
          <input
            ref={passwordRef}
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="กรอกรหัสผ่าน"
            className="field pr-12!"
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            onBlur={() => setCapsLock(false)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={showPassword}
            className="icon-btn absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {showPassword ? (
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7 0 .9-.8 2.4-2.2 3.8M6.6 6.6C4.4 8 3 10.4 3 12c0 2 4 7 9 7 1.6 0 3-.4 4.3-1.1" />
              ) : (
                <>
                  <path d="M3 12c0-2 4-7 9-7s9 5 9 7-4 7-9 7-9-5-9-7z" />
                  <circle cx="12" cy="12" r="2.5" />
                </>
              )}
            </svg>
          </button>
        </span>
        {/* ช่องสูงคงที่: ข้อความ Caps Lock แสดง/ซ่อนโดยไม่ดันฟอร์ม */}
        <span aria-live="polite" className={`mt-1.5 block h-4 text-xs leading-4 text-warn ${capsLock ? "" : "invisible"}`}>Caps Lock เปิดอยู่</span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      {/* ช่องใต้ปุ่มจองความสูงไว้ตลอด (การ์ดตั้งบนโต๊ะ ถ้าสูงขึ้นจะยืดขึ้นด้านบนและช่องกรอกขยับหนี)
          ปกติ = คำแนะนำเมื่อเข้าใช้ไม่ได้ · ล็อกอินไม่ผ่าน = ข้อความ error แทนที่ */}
      <div className="flex min-h-[3.25rem] flex-col justify-center">
        {!state.error && <p className="text-center text-xs leading-relaxed text-ink-3">ลืมรหัสผ่านหรือเข้าใช้งานไม่ได้ ติดต่อผู้ดูแลระบบ</p>}
        {state.error && (
          <p role="alert" className="login-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="line-clamp-2">{state.error}</span>
          </p>
        )}
      </div>
    </form>
  );
}
