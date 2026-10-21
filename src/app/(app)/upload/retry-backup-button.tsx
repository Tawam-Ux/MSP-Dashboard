"use client";

import { useActionState, useCallback, useState } from "react";
import { Spinner, Toast } from "@/frontend/components/toast";
import { retryBackup, type RetryState } from "./actions";

/**
 * ปุ่มส่งไฟล์ที่รอ backup ขึ้น Google Drive อีกครั้ง
 * ขนาดปุ่มคงที่: ระหว่างส่งเปลี่ยนแค่ไอคอน · ไม่สำเร็จ = ข้อความลอยมุมจอ (ไม่ดันแถวตาราง)
 */
export function RetryBackupButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState<RetryState, FormData>(retryBackup, { status: "idle" });
  // ผลที่ผู้ใช้ปิดข้อความไปแล้ว — กดส่งใหม่ได้ state ใหม่ (object ใหม่) ข้อความจึงแสดงอีกครั้งถ้ายังไม่สำเร็จ
  const [dismissed, setDismissed] = useState<RetryState | null>(null);
  const failed = state.status === "done" && state !== dismissed ? state.results.find((r) => !r.ok) : undefined;
  const error = failed ? `ส่งขึ้น Drive ไม่สำเร็จ: ${failed.error}` : null;
  const clearError = useCallback(() => setDismissed(state), [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-soft min-h-8 px-3! text-xs! disabled:opacity-60"
      >
        {pending ? (
          <Spinner size={12} />
        ) : (
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
          </svg>
        )}
        ส่งขึ้น Drive อีกครั้ง
      </button>
      <Toast message={error} onClose={clearError} />
    </form>
  );
}
