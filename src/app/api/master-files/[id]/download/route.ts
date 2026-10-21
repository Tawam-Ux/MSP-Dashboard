import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { uploadLogs } from "@/backend/db/schema";
import { apiError, requireApiPermission } from "@/backend/lib/admin-api";
import { DriveError, downloadDriveFile } from "@/backend/lib/google-drive";
import { readMasterFile } from "@/backend/lib/master-storage";

// ดาวน์โหลดไฟล์ Master จากประวัติการนำเข้า (หน้า Upload Data)
// ไฟล์ที่ใช้อยู่ / รอ backup = อ่านจากเครื่อง · ย้ายไป Drive แล้ว = ดึงจาก Google Drive ผ่านเซิร์ฟเวอร์ (ผู้ใช้ไม่ต้องมีสิทธิ์ใน Drive)

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** ชื่อไฟล์ภาษาไทย: filename* (RFC 5987) สำหรับเบราว์เซอร์ปัจจุบัน + filename แบบ ASCII สำรอง */
function attachment(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/master-files/[id]/download">) {
  const me = await requireApiPermission("data.upload");
  if (me instanceof Response) return me;

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return apiError(400, "รหัสไฟล์ไม่ถูกต้อง");
  const [log] = await db
    .select({ fileName: uploadLogs.fileName, storedPath: uploadLogs.storedPath, driveFileId: uploadLogs.driveFileId })
    .from(uploadLogs)
    .where(eq(uploadLogs.id, id))
    .limit(1);
  if (!log) return apiError(404, "ไม่พบประวัติการนำเข้านี้");

  const headers = { "Content-Type": XLSX_MIME, "Content-Disposition": attachment(log.fileName), "Cache-Control": "private, no-store" };

  if (log.storedPath) {
    try {
      const data = await readMasterFile(log.storedPath);
      return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
    } catch {
      // ไฟล์ในเครื่องหายไป — ลองจาก Drive ต่อถ้ามี
      if (!log.driveFileId) return apiError(404, "ไม่พบไฟล์ในเครื่อง");
    }
  }

  if (log.driveFileId) {
    try {
      const res = await downloadDriveFile(log.driveFileId);
      const length = res.headers.get("content-length");
      return new Response(res.body, { headers: length ? { ...headers, "Content-Length": length } : headers });
    } catch (e) {
      if (e instanceof DriveError) return apiError(e.message.includes("HTTP 404") ? 404 : 502, e.message);
      throw e;
    }
  }

  return apiError(404, "ไม่มีไฟล์ต้นฉบับ (นำเข้าก่อนมีระบบเก็บไฟล์ Master)");
}
