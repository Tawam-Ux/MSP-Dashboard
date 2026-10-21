import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/backend/db";
import { uploadLogs } from "@/backend/db/schema";
import { DriveError, checkDriveFiles, uploadToBackupFolder } from "./google-drive";
import { readMasterFile, removeMasterFile } from "./master-storage";

export type BackupResult = { id: number; fileName: string; ok: boolean; error?: string };

type MasterRow = { id: number; fileName: string; storedPath: string | null; createdAt: Date; period: string; driveFileId: string | null };

const rowColumns = {
  id: uploadLogs.id, fileName: uploadLogs.fileName, storedPath: uploadLogs.storedPath, createdAt: uploadLogs.createdAt,
  period: uploadLogs.period, driveFileId: uploadLogs.driveFileId,
};

/**
 * อัปโหลดไฟล์ในเครื่องของแถวนี้ขึ้นโฟลเดอร์ปีของไฟล์ ("ปี 2568") ในโฟลเดอร์ backup
 * ใส่วันเวลาที่นำเข้าไว้หน้าชื่อ กันชื่อซ้ำเมื่ออัปโหลดไฟล์ชื่อเดิมหลายครั้ง
 */
async function uploadMaster(m: MasterRow) {
  const data = await readMasterFile(m.storedPath!);
  const stamp = m.createdAt.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  return uploadToBackupFolder(`${stamp}_${m.fileName}`, data, `ปี ${Number(m.period.slice(0, 4)) + 543}`);
}

/** สำเนาใน Drive ที่อัปโหลดไว้แล้ว (จากปุ่มเปิดใน Google Sheets) ยังอยู่จริงไหม — ใช้ต่อได้ไม่ต้องอัปโหลดซ้ำ */
async function existingCopy(m: MasterRow): Promise<string | null> {
  if (!m.driveFileId) return null;
  const state = (await checkDriveFiles([m.driveFileId])).get(m.driveFileId);
  return state === "found" ? m.driveFileId : null;
}

const describe = (e: unknown) =>
  e instanceof DriveError ? e.message
    : (e as NodeJS.ErrnoException)?.code === "ENOENT" ? "ไม่พบไฟล์ในเครื่อง (อาจถูกลบไปแล้ว)"
    : `${e instanceof Error ? e.message : String(e)}`;

/**
 * ย้ายไฟล์ Master เก่าที่รอ backup ขึ้น Google Drive (ระบุ ids หรือทุกไฟล์ที่รออยู่)
 * เคยมีสำเนาใน Drive แล้ว (เปิดใน Google Sheets ตอนยังใช้งานอยู่) = ใช้สำเนานั้นเป็น backup ไม่อัปโหลดซ้ำ
 * สำเร็จ = ลบไฟล์ในเครื่อง · ไม่สำเร็จ = เก็บไฟล์ไว้ และบันทึกเหตุผลให้กดลองใหม่ได้
 */
export async function backupPendingMasters(db: Db, ids?: number[]): Promise<BackupResult[]> {
  const pending = await db
    .select(rowColumns)
    .from(uploadLogs)
    .where(and(
      eq(uploadLogs.status, "backup_pending"),
      isNotNull(uploadLogs.storedPath),
      ids ? inArray(uploadLogs.id, ids.length ? ids : [-1]) : undefined,
    ));

  const results: BackupResult[] = [];
  for (const m of pending) {
    try {
      const reused = await existingCopy(m);
      const uploaded = reused ? null : await uploadMaster(m);
      await db.update(uploadLogs).set({
        status: "backed_up", backedUpAt: new Date(), backupError: null, storedPath: null,
        ...(uploaded && { driveFileId: uploaded.id, driveLink: uploaded.link }),
      }).where(eq(uploadLogs.id, m.id));
      await removeMasterFile(m.storedPath!);
      results.push({ id: m.id, fileName: m.fileName, ok: true });
    } catch (e) {
      const error = e instanceof DriveError || (e as NodeJS.ErrnoException)?.code === "ENOENT" ? describe(e) : `backup ไม่สำเร็จ: ${describe(e)}`;
      await db.update(uploadLogs).set({ backupError: error.slice(0, 500) }).where(eq(uploadLogs.id, m.id));
      results.push({ id: m.id, fileName: m.fileName, ok: false, error });
    }
  }
  return results;
}

export class NoMasterFileError extends Error {}

/**
 * id ของไฟล์ใน Drive สำหรับเปิดด้วย Google Sheets
 * มีใน Drive อยู่แล้ว (ย้ายไป backup / เคยเปิดมาก่อน) = ใช้ไฟล์นั้น · มีแค่ในเครื่อง (ใช้งานอยู่ / รอ backup) = อัปโหลดสำเนาเข้าโฟลเดอร์ปี
 * แล้วจำ id ไว้ (driveFileId) — ครั้งต่อไปเปิดทันที และตอนย้ายไป backup จะใช้สำเนานี้ ไม่อัปโหลดซ้ำ
 */
export async function ensureDriveCopy(db: Db, id: number): Promise<string> {
  const [m] = await db.select(rowColumns).from(uploadLogs).where(eq(uploadLogs.id, id)).limit(1);
  if (!m) throw new NoMasterFileError("ไม่พบประวัติการนำเข้านี้");
  const reused = await existingCopy(m);
  if (reused) return reused;
  if (!m.storedPath) {
    throw new NoMasterFileError(m.driveFileId ? "ไฟล์ถูกลบหรือย้ายไปถังขยะใน Google Drive แล้ว" : "ไม่มีไฟล์ต้นฉบับ (นำเข้าก่อนมีระบบเก็บไฟล์ Master)");
  }
  try {
    const uploaded = await uploadMaster(m);
    await db.update(uploadLogs).set({ driveFileId: uploaded.id, driveLink: uploaded.link }).where(eq(uploadLogs.id, m.id));
    return uploaded.id;
  } catch (e) {
    if (e instanceof DriveError) throw e;
    throw new NoMasterFileError(describe(e));
  }
}
