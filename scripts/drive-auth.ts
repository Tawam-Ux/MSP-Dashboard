// เชื่อม Google Drive (Gmail ส่วนตัว) ครั้งเดียว: npm run drive:auth
// ต้องตั้ง GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน .env ก่อน (OAuth client แบบ "Desktop app" — ดู README)
// สคริปต์จะเปิดเบราว์เซอร์ให้ล็อกอินอนุญาต แล้วบันทึก GOOGLE_REFRESH_TOKEN และ GOOGLE_DRIVE_BACKUP_FOLDER_ID ลง .env
import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { DRIVE_SCOPE, accessToken } from "@/backend/lib/google-drive";

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const FOLDER_NAME = "MSP Dashboard - Master Backup";

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : process.platform === "darwin" ? ["open", [url]]
    : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

/** แก้หรือเพิ่มค่าใน .env โดยไม่แตะบรรทัดอื่น */
function setEnv(values: Record<string, string>) {
  let text = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${text.endsWith("\n") || !text ? "" : "\n"}${line}\n`;
  }
  writeFileSync(".env", text);
}

/** รอให้ผู้ใช้อนุญาตในเบราว์เซอร์ แล้วรับ authorization code กลับมา */
function waitForCode(state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/callback") return void res.writeHead(404).end();
      const code = url.searchParams.get("code");
      const ok = code && url.searchParams.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<p style="font-family:sans-serif">${ok ? "เชื่อม Google Drive สำเร็จ ปิดหน้านี้แล้วกลับไปที่ terminal ได้เลย" : "ไม่สำเร็จ ลองรันคำสั่งใหม่อีกครั้ง"}</p>`);
      server.close();
      if (ok) resolve(code);
      else reject(new Error(`Google ปฏิเสธการอนุญาต: ${url.searchParams.get("error") ?? "state ไม่ตรง"}`));
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1");
  });
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ตั้ง GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน .env ก่อน (สร้าง OAuth client แบบ Desktop app ใน Google Cloud Console — ดู README)");
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  })}`;

  const codePromise = waitForCode(state);
  console.log("เปิดเบราว์เซอร์เพื่อล็อกอิน Google และอนุญาตให้ระบบเก็บไฟล์ใน Drive");
  console.log(`ถ้าเบราว์เซอร์ไม่เปิดเอง ให้คัดลอกลิงก์นี้ไปเปิด:\n${authUrl}\n`);
  openBrowser(authUrl);
  const code = await codePromise;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  });
  const token = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!res.ok || !token.refresh_token) {
    throw new Error(`ขอ refresh token ไม่สำเร็จ: ${token.error_description ?? "Google ไม่ส่ง refresh_token กลับมา — ลบสิทธิ์แอปที่ https://myaccount.google.com/permissions แล้วรันใหม่"}`);
  }
  setEnv({ GOOGLE_REFRESH_TOKEN: token.refresh_token });
  console.log("✓ บันทึก GOOGLE_REFRESH_TOKEN ลง .env แล้ว");

  // สิทธิ์ drive.file เข้าถึงได้เฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง จึงให้แอปสร้างโฟลเดอร์ backup เอง
  // ถ้า .env มี folder id อยู่แล้วแต่แอปเข้าไม่ได้ (เช่นโฟลเดอร์ที่สร้างเองใน Drive) ให้สร้างใหม่แทน
  const access = await accessToken({ clientId, clientSecret, refreshToken: token.refresh_token });
  let folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
  if (folderId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const info = (await check.json().catch(() => ({}))) as { trashed?: boolean };
    if (!check.ok || info.trashed) {
      console.log(`โฟลเดอร์ใน .env (${folderId}) แอปเข้าถึงไม่ได้ — จะสร้างโฟลเดอร์ใหม่ที่แอปจัดการได้แทน`);
      folderId = undefined;
    }
  }
  if (!folderId) {
    const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    const folder = (await created.json()) as { id?: string; webViewLink?: string; error?: { message: string } };
    if (!created.ok || !folder.id) throw new Error(`สร้างโฟลเดอร์ใน Drive ไม่สำเร็จ: ${folder.error?.message ?? created.status}`);
    folderId = folder.id;
    setEnv({ GOOGLE_DRIVE_BACKUP_FOLDER_ID: folderId });
    console.log(`✓ สร้างโฟลเดอร์ "${FOLDER_NAME}" ใน My Drive แล้ว: ${folder.webViewLink ?? folderId}`);
  } else {
    console.log(`ใช้โฟลเดอร์เดิม GOOGLE_DRIVE_BACKUP_FOLDER_ID=${folderId}`);
  }
  console.log("\nเสร็จแล้ว — รีสตาร์ต npm start เพื่อให้ระบบโหลดค่าใหม่จาก .env");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
