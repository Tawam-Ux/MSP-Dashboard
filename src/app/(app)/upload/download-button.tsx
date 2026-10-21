"use client";

import { useCallback, useState } from "react";
import { Spinner, Toast } from "@/frontend/components/toast";

/**
 * ปุ่มดาวน์โหลดไฟล์ Master ในประวัติการนำเข้า — ดึงผ่าน fetch แล้วบันทึกเป็นไฟล์
 * (ไม่ใช้ลิงก์ตรง: ถ้าดึงไม่สำเร็จ เบราว์เซอร์จะบันทึกข้อความ error เป็นไฟล์แทน)
 * ขนาดปุ่มคงที่ทุกสถานะ: ระหว่างโหลดเปลี่ยนแค่ไอคอนเป็นวงหมุน · ไม่สำเร็จ = ข้อความลอยมุมจอ (ไม่ดันแถวตาราง)
 */
export function DownloadButton({ id, fileName }: { id: number; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/master-files/${id}/download`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `ดาวน์โหลดไม่สำเร็จ (${res.status})`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(`ดาวน์โหลด ${fileName} ไม่สำเร็จ: ${e instanceof Error ? e.message : "ลองใหม่อีกครั้ง"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        aria-label={`ดาวน์โหลด ${fileName}`}
        className="btn-soft min-h-8 px-3! text-xs! hover:bg-brand-soft! hover:text-brand! disabled:opacity-60"
      >
        {busy ? (
          <Spinner />
        ) : (
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
          </svg>
        )}
        ดาวน์โหลด
      </button>
      <Toast message={error} onClose={clearError} />
    </>
  );
}
