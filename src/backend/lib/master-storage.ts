import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// ที่เก็บไฟล์ Master ในเครื่อง: ไฟล์ที่ใช้อยู่ + ไฟล์เก่าที่ยังรอส่งขึ้น Google Drive
// ตั้ง MASTER_STORAGE_DIR ใน .env ถ้าต้องการเก็บที่อื่น (ค่าเริ่มต้น: <โปรเจกต์>/storage/masters)
const storageDir = () => process.env.MASTER_STORAGE_DIR || path.join(process.cwd(), "storage", "masters");

/** บันทึกไฟล์ คืน path สัมพัทธ์ที่ใช้เก็บในฐานข้อมูล */
export async function saveMasterFile(data: Buffer): Promise<string> {
  const name = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.xlsx`;
  await mkdir(storageDir(), { recursive: true });
  await writeFile(path.join(storageDir(), name), data);
  return name;
}

const resolve = (stored: string) => path.join(storageDir(), path.basename(stored));

export const readMasterFile = (stored: string) => readFile(resolve(stored));

export const removeMasterFile = (stored: string) => rm(resolve(stored), { force: true });
