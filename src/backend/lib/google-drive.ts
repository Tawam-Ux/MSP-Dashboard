// อัปโหลดไฟล์ขึ้น Google Drive (Gmail ส่วนตัว ผ่าน OAuth refresh token) — ใช้ REST API ตรงๆ ไม่ต้องลง SDK
// ค่าที่ต้องตั้งใน .env (ได้จาก `npm run drive:auth`):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_BACKUP_FOLDER_ID

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TIMEOUT_MS = 60_000;

export class DriveError extends Error {}

export function driveConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_BACKUP_FOLDER_ID } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_BACKUP_FOLDER_ID) return null;
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken: GOOGLE_REFRESH_TOKEN, folderId: GOOGLE_DRIVE_BACKUP_FOLDER_ID };
}

async function call(url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new DriveError(`เชื่อมต่อ Google ไม่ได้ (${what}) — ตรวจการเชื่อมต่ออินเทอร์เน็ต`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const reason = body.match(/"(?:error_description|message)"\s*:\s*"([^"]+)"/)?.[1] ?? body.slice(0, 200);
    throw new DriveError(`${what} ไม่สำเร็จ (HTTP ${res.status}): ${reason}`);
  }
  return res;
}

export async function accessToken(cfg: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
  const res = await call("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: "refresh_token",
    }),
  }, "ขอสิทธิ์ Google Drive");
  return ((await res.json()) as { access_token: string }).access_token;
}

/** ลิงก์เปิดไฟล์ .xlsx ใน Drive ด้วย Google Sheets (โหมดแก้ไขไฟล์ Office — ไม่แปลงไฟล์ ไม่สร้างสำเนา) */
export const sheetsUrl = (fileId: string) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/edit`;

export type DriveFileState = "found" | "missing" | "unknown";

/**
 * ตรวจว่าไฟล์ยังอยู่ใน Drive จริงไหม (ถูกลบถาวร = 404, อยู่ในถังขยะ = trashed → นับว่า missing)
 * เชื่อมต่อ/ขอสิทธิ์ไม่ได้ = unknown เพื่อไม่ให้ขึ้นว่าไม่พบไฟล์ทั้งที่จริงๆ แค่เน็ตหลุด
 */
export async function checkDriveFiles(ids: string[]): Promise<Map<string, DriveFileState>> {
  const result = new Map<string, DriveFileState>(ids.map((id) => [id, "unknown"]));
  const cfg = driveConfig();
  if (!cfg || ids.length === 0) return result;
  let token: string;
  try {
    token = await accessToken(cfg);
  } catch {
    return result;
  }
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.status === 404) result.set(id, "missing");
      else if (res.ok) result.set(id, ((await res.json()) as { trashed?: boolean }).trashed ? "missing" : "found");
    } catch {
      // คงเป็น unknown
    }
  }));
  return result;
}

/** ดาวน์โหลดเนื้อไฟล์จาก Drive — คืน Response ของ Google ตรงๆ เพื่อส่งต่อแบบสตรีม (ไม่โหลดทั้งไฟล์เข้าหน่วยความจำ) */
export async function downloadDriveFile(id: string): Promise<Response> {
  const cfg = driveConfig();
  if (!cfg) throw new DriveError("ยังไม่ได้ตั้งค่า Google Drive ใน .env (รัน npm run drive:auth)");
  const token = await accessToken(cfg);
  return call(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }, "ดาวน์โหลดไฟล์จาก Google Drive");
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * โฟลเดอร์ย่อยชื่อ name ในโฟลเดอร์ parent — มีแล้วใช้ของเดิม ไม่มีสร้างใหม่
 * สิทธิ์ drive.file เห็นเฉพาะไฟล์/โฟลเดอร์ที่ระบบนี้สร้างเอง: โฟลเดอร์ที่สร้างด้วยมือใน Drive จะไม่ถูกพบ (ระบบสร้างชื่อเดียวกันขึ้นอีกอัน)
 */
async function subfolderId(token: string, parent: string, name: string): Promise<string> {
  const q = `name = '${name.replace(/['\\]/g, "\\$&")}' and mimeType = '${FOLDER_MIME}' and '${parent}' in parents and trashed = false`;
  const found = await call(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: "files(id)", pageSize: "1" })}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }, `ค้นหาโฟลเดอร์ ${name}`);
  const [existing] = ((await found.json()) as { files: { id: string }[] }).files;
  if (existing) return existing.id;

  const created = await call("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  }, `สร้างโฟลเดอร์ ${name}`);
  return ((await created.json()) as { id: string }).id;
}

/**
 * อัปโหลดไฟล์ .xlsx เข้าโฟลเดอร์ backup (resumable upload รองรับไฟล์ใหญ่กว่า 5MB)
 * folder = ชื่อโฟลเดอร์ย่อยในโฟลเดอร์ backup (เช่น "ปี 2568") — ไม่มีจะสร้างให้ · ไม่ส่ง = วางในโฟลเดอร์ backup ตรงๆ
 */
export async function uploadToBackupFolder(fileName: string, data: Buffer, folder?: string): Promise<{ id: string; link: string | null }> {
  const cfg = driveConfig();
  if (!cfg) throw new DriveError("ยังไม่ได้ตั้งค่า Google Drive ใน .env (รัน npm run drive:auth)");
  const token = await accessToken(cfg);
  const parent = folder ? await subfolderId(token, cfg.folderId, folder) : cfg.folderId;

  const start = await call("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": XLSX_MIME,
      "X-Upload-Content-Length": String(data.length),
    },
    body: JSON.stringify({ name: fileName, parents: [parent], mimeType: XLSX_MIME }),
  }, "เริ่มอัปโหลด");
  const location = start.headers.get("location");
  if (!location) throw new DriveError("Google Drive ไม่ได้ส่งที่อยู่สำหรับอัปโหลดกลับมา");

  const done = await call(location, {
    method: "PUT",
    headers: { "Content-Type": XLSX_MIME, "Content-Length": String(data.length) },
    body: new Uint8Array(data),
  }, "อัปโหลดไฟล์");
  const file = (await done.json()) as { id: string; webViewLink?: string };
  return { id: file.id, link: file.webViewLink ?? null };
}
