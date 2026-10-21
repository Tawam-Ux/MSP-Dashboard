"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Spinner, Toast } from "@/frontend/components/toast";

const SheetIcon = () => (
  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M4 9.5h16M4 15h16M10 9.5v11" />
  </svg>
);

const CLASS = "btn-soft min-h-8 px-3! text-xs! text-brand! hover:bg-brand-soft! disabled:opacity-60";

/**
 * ปุ่ม "เปิด" ในประวัติการนำเข้า (เฉพาะผู้ดูแลระบบ): เปิดไฟล์ Master ด้วย Google Sheets ในแท็บใหม่
 * url = ไฟล์อยู่ใน Drive แล้ว → ลิงก์ตรง · ไม่มี url = ไฟล์อยู่แค่ในเครื่อง → ขอให้เซิร์ฟเวอร์อัปโหลดสำเนาขึ้น Drive ก่อน (ครั้งแรกครั้งเดียว)
 * เปิดแท็บว่างทันทีตอนกด (เบราว์เซอร์จะไม่บล็อกป๊อปอัป) แล้วค่อยพาไปลิงก์เมื่อได้ · ไม่สำเร็จ = ปิดแท็บนั้น + ข้อความลอยมุมจอ
 */
export function OpenSheetButton({ id, fileName, url }: { id: number; fileName: string; url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const label = `เปิด ${fileName} ใน Google Sheets`;

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" aria-label={label} title="เปิดใน Google Sheets" className={CLASS}>
        <SheetIcon />
        เปิด
      </a>
    );
  }

  const open = async () => {
    const tab = window.open("", "_blank");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/master-files/${id}/sheet`, { method: "POST", cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.url) throw new Error(body?.message ?? `เปิดไม่สำเร็จ (${res.status})`);
      if (tab) {
        tab.opener = null;
        tab.location.href = body.url;
      } else {
        window.open(body.url, "_blank", "noreferrer");
      }
      // ไฟล์มีสำเนาใน Drive แล้ว — โหลดหน้าใหม่ให้ปุ่มเป็นลิงก์ตรง (ครั้งต่อไปไม่ต้องรอ)
      router.refresh();
    } catch (e) {
      tab?.close();
      setError(`เปิด ${fileName} ไม่สำเร็จ: ${e instanceof Error ? e.message : "ลองใหม่อีกครั้ง"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy} aria-busy={busy} aria-label={label} title="อัปโหลดสำเนาขึ้น Google Drive แล้วเปิดใน Google Sheets" className={CLASS}>
        {busy ? <Spinner /> : <SheetIcon />}
        เปิด
      </button>
      <Toast message={error} onClose={clearError} />
    </>
  );
}
