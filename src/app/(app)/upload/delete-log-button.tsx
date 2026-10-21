"use client";

import { deleteActiveMaster, deleteUploadLog } from "./actions";
import { ConfirmPopButton } from "./confirm-pop";

/**
 * ปุ่มลบแถวในประวัติการนำเข้า (กล่องยืนยันเด้งข้างปุ่ม)
 * ไฟล์ที่ใช้งานอยู่ลบจากแถวนี้ไม่ได้ (ลบได้ที่การ์ด ข้อมูลในระบบ) · ไฟล์ที่อยู่ใน Google Drive แล้วไม่ถูกลบ
 */
export function DeleteLogButton({ id, fileName, active, pendingLocal }: { id: number; fileName: string; active: boolean; pendingLocal: boolean }) {
  if (active) {
    return (
      <span title="ไฟล์ที่ Dashboard ใช้อยู่ — ลบได้ที่การ์ด ไฟล์ที่ใช้อยู่"className="btn-soft min-h-8 cursor-not-allowed px-3! text-xs! opacity-50">
        ลบ
      </span>
    );
  }
  return (
    <ConfirmPopButton label="ลบ" confirmLabel="ยืนยันลบ" ariaLabel={`ยืนยันลบ ${fileName}`} action={deleteUploadLog} hidden={{ id }}>
      <p className="text-ink-2">
        ลบ <span className="font-medium break-all text-ink">{fileName}</span>?
      </p>
      <p className={`mt-1 ${pendingLocal ? "text-loss-text" : "text-ink-3"}`}>
        {pendingLocal ? "ไฟล์นี้ยังไม่ได้ backup — ลบแล้วไฟล์หายถาวร" : "ลบเฉพาะประวัติ ไฟล์ใน Google Drive ยังอยู่"}
      </p>
    </ConfirmPopButton>
  );
}

/**
 * ปุ่มลบไฟล์ที่ใช้งานอยู่ของปีหนึ่ง (การ์ด ไฟล์ที่ใช้อยู่): ข้อมูลของปีนั้นใน Dashboard ถูกลบ ปีอื่นไม่เปลี่ยน
 * ค่าเริ่มต้นเก็บไฟล์ไว้ในประวัติ (ย้ายขึ้น Google Drive) · เอาติ๊กออก = ลบไฟล์ทิ้งด้วย
 */
export function DeleteActiveButton({ id, fileName, yearBE }: { id: number; fileName: string; yearBE: number }) {
  return (
    <ConfirmPopButton label="ลบข้อมูล" confirmLabel="ยืนยันลบข้อมูล" ariaLabel={`ยืนยันลบข้อมูลปี ${yearBE} จาก ${fileName}`} action={deleteActiveMaster} hidden={{ id }}>
      <p className="text-ink-2">
        ลบข้อมูลปี {yearBE} จาก <span className="font-medium break-all text-ink">{fileName}</span>?
      </p>
      <p className="mt-1 text-loss-text">ตัวเลขปี {yearBE} ใน Dashboard จะหายไป จนกว่าจะนำเข้าไฟล์ของปีนี้ใหม่ · ปีอื่นไม่เปลี่ยน</p>
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-ink-2">
        <input type="checkbox" name="keepFile" defaultChecked className="mt-0.5 accent-(--brand)" />
        <span>เก็บไฟล์ไว้ในประวัติการนำเข้า (ย้ายขึ้น Google Drive)</span>
      </label>
    </ConfirmPopButton>
  );
}
