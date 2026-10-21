import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// ไฟล์ที่ผู้ใช้อัปโหลดค้างไว้ (ตรวจแล้วแต่ยังไม่กดยืนยันนำเข้า) — เก็บที่เซิร์ฟเวอร์แยกตามผู้ใช้ 1 ไฟล์ต่อคน
// เปลี่ยนหน้า/รีเฟรช/ปิดเบราว์เซอร์แล้วกลับมาหน้าอัปโหลด ไฟล์ยังอยู่ที่เดิม จนกว่าจะนำเข้าสำเร็จ ยกเลิก หรือเลือกไฟล์ใหม่
// ตั้ง MASTER_STORAGE_DIR ใน .env ได้เหมือนไฟล์ Master (ค่าเริ่มต้น: <โปรเจกต์>/storage/drafts)

export type UploadDraft = { fileName: string; sizeBytes: number; yearBE: number; savedAt: string };

const draftDir = () =>
  process.env.MASTER_STORAGE_DIR ? path.join(path.dirname(process.env.MASTER_STORAGE_DIR), "drafts") : path.join(process.cwd(), "storage", "drafts");

const filePath = (userId: number) => path.join(draftDir(), `${userId}.xlsx`);
const metaPath = (userId: number) => path.join(draftDir(), `${userId}.json`);

export async function saveDraft(userId: number, meta: Omit<UploadDraft, "savedAt">, data: Buffer) {
  await mkdir(draftDir(), { recursive: true });
  await writeFile(filePath(userId), data);
  await writeFile(metaPath(userId), JSON.stringify({ ...meta, savedAt: new Date().toISOString() } satisfies UploadDraft));
}

/** ข้อมูลไฟล์ค้างของผู้ใช้ หรือ null ถ้าไม่มี/ไฟล์เสีย */
export async function getDraft(userId: number): Promise<UploadDraft | null> {
  try {
    return JSON.parse(await readFile(metaPath(userId), "utf8")) as UploadDraft;
  } catch {
    return null;
  }
}

export async function readDraftFile(userId: number): Promise<Buffer | null> {
  try {
    return await readFile(filePath(userId));
  } catch {
    return null;
  }
}

/** จำปี พ.ศ. ที่ผู้ใช้แก้ไว้ (กลับมาแล้วไม่ต้องใส่ใหม่) */
export async function setDraftYear(userId: number, yearBE: number) {
  const draft = await getDraft(userId);
  if (draft) await writeFile(metaPath(userId), JSON.stringify({ ...draft, yearBE }));
}

export async function clearDraft(userId: number) {
  await Promise.all([rm(filePath(userId), { force: true }), rm(metaPath(userId), { force: true })]);
}
