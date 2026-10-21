import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { apiError, requireApiPermission } from "@/backend/lib/admin-api";
import { DriveError, driveConfig, sheetsUrl } from "@/backend/lib/google-drive";
import { NoMasterFileError, ensureDriveCopy } from "@/backend/lib/master-backup";

// เปิดไฟล์ Master จากประวัติการนำเข้าด้วย Google Sheets (หน้า Upload Data) — เฉพาะผู้ดูแลระบบ (users.manage)
// ไฟล์ที่มีแค่ในเครื่อง (ใช้งานอยู่ / รอ backup) อัปโหลดสำเนาขึ้นโฟลเดอร์ปีใน Drive ก่อน (ครั้งแรกครั้งเดียว) — ตอบลิงก์กลับไปให้หน้าเว็บเปิดแท็บใหม่
// ไฟล์ใน Drive เป็นของบัญชี Google ที่เชื่อมไว้ (npm run drive:auth) — เปิดได้เมื่อล็อกอิน Google บัญชีนั้นในเบราว์เซอร์ ไม่มีระบบขอสิทธิ์ให้บัญชีอื่น

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/master-files/[id]/sheet">) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  if (!driveConfig()) return apiError(503, "ยังไม่ได้เชื่อม Google Drive — ตั้งค่าด้วย npm run drive:auth");

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return apiError(400, "รหัสไฟล์ไม่ถูกต้อง");
  try {
    return Response.json({ url: sheetsUrl(await ensureDriveCopy(db, id)) });
  } catch (e) {
    if (e instanceof NoMasterFileError) return apiError(404, e.message);
    if (e instanceof DriveError) return apiError(502, e.message);
    throw e;
  }
}
