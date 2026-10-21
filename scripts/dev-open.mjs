// ปรับโครงสร้างฐานข้อมูลให้ตรงกับ src/backend/db/schema.ts (drizzle-kit push) ก่อน
// แล้วเปิด `next dev` (Hot Reload — แก้โค้ดแล้วเว็บอัปเดตเองทันที) และเปิดเบราว์เซอร์ให้อัตโนมัติเมื่อเซิร์ฟเวอร์พร้อม
// เมื่อเว็บพร้อมจะเปิดแอปหลังบ้าน (admin-app/, Vite) ให้ด้วย — log ขึ้นต้นด้วย [admin]
// ตั้ง NO_OPEN=1 ถ้าไม่ต้องการให้เปิดเบราว์เซอร์, NO_ADMIN=1 ถ้าไม่ต้องการเปิดแอปหลังบ้าน, NO_DB_PUSH=1 ถ้าไม่ต้องการปรับฐานข้อมูล
// อาร์กิวเมนต์อื่นส่งต่อให้ next dev เช่น `npm start -- -p 4000`
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const viteBin = path.join(root, "admin-app", "node_modules", "vite", "bin", "vite.js");
const env = { ...process.env };
// รหัสรอบการทำงาน: npm start ใหม่ = รหัสใหม่ = ทุกคนต้องล็อกอินใหม่ (ดู BOOT_ID ใน src/backend/auth.ts)
env.MSP_BOOT_ID = randomUUID();
// stdout ถูก pipe ทำให้ Next/Vite ปิดสี — บังคับเปิดสีไว้ ยกเว้นผู้ใช้ตั้ง NO_COLOR
if (!env.NO_COLOR) env.FORCE_COLOR ??= "1";

// stdio ต่อกับเทอร์มินัลตรงๆ: ถ้าการเปลี่ยนแปลงอาจทำข้อมูลหาย drizzle-kit จะถามยืนยันก่อนเสมอ
if (process.env.NO_DB_PUSH !== "1") {
  // ย้ายข้อมูลหลักเป็นแบบแยกปีก่อน (drizzle-kit เปลี่ยน primary key ของตารางที่มีข้อมูลเองไม่ได้) — ย้ายแล้วสคริปต์ข้ามเอง
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (existsSync(tsxCli)) {
    const migrate = spawnSync(process.execPath, [tsxCli, path.join(root, "scripts", "migrate-master-years.ts")], { cwd: root, stdio: "inherit", env });
    if (migrate.status !== 0) console.log("\x1b[33m[db]\x1b[0m ย้ายข้อมูลหลักเป็นแบบแยกปีไม่สำเร็จ — ดูข้อความด้านบน");
  }
  console.log("\x1b[36m[db]\x1b[0m ตรวจโครงสร้างฐานข้อมูล (drizzle-kit push)...");
  // drizzle-kit ไม่ export bin.cjs ใน package.json จึง require.resolve ไม่ได้ — อ้างไฟล์ตรงๆ
  const drizzleBin = path.join(root, "node_modules", "drizzle-kit", "bin.cjs");
  const push = existsSync(drizzleBin)
    ? spawnSync(process.execPath, [drizzleBin, "push"], { cwd: root, stdio: "inherit", env })
    : { status: 1 };
  if (push.status !== 0) {
    console.log("\x1b[33m[db]\x1b[0m ปรับฐานข้อมูลไม่สำเร็จ — เปิดเว็บต่อ แต่หน้าที่ใช้คอลัมน์ใหม่อาจ error (ดูข้อความด้านบน)");
  }
}

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: ["inherit", "pipe", "inherit"],
  env,
});

let opened = process.env.NO_OPEN === "1";
let adminStarted = process.env.NO_ADMIN === "1";
let admin = null;
let url = null;
let buffer = "";

function openBrowser(target) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", target]]
    : process.platform === "darwin" ? ["open", [target]]
    : ["xdg-open", [target]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

/** พิมพ์ทีละบรรทัดพร้อม [admin] นำหน้า แยก log ออกจากของ Next */
function prefixed(stream, out) {
  let rest = "";
  stream.on("data", (chunk) => {
    const lines = (rest + chunk.toString()).split(/\r?\n/);
    rest = lines.pop() ?? "";
    for (const line of lines) out.write(`\x1b[35m[admin]\x1b[0m ${line}\n`);
  });
}

function startAdmin(dashboardUrl) {
  if (!existsSync(viteBin)) {
    console.log("\x1b[33m[admin]\x1b[0m ยังไม่ได้ติดตั้งแอปหลังบ้าน — รัน `cd admin-app && npm install` ก่อน (ข้ามไปก่อน)");
    return;
  }
  // ชี้ proxy /api ของ Vite ไปที่ URL จริงของ Next (เผื่อ Next เปลี่ยนพอร์ตเอง)
  admin = spawn(process.execPath, [viteBin], {
    cwd: path.join(root, "admin-app"),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...env, VITE_DASHBOARD_URL: dashboardUrl },
  });
  prefixed(admin.stdout, process.stdout);
  prefixed(admin.stderr, process.stderr);
  admin.on("exit", (code) => {
    admin = null;
    // เว็บหลักยังทำงานต่อได้ แค่เมนู Admin จะเปิดไม่ขึ้น
    if (code) console.log(`\x1b[33m[admin]\x1b[0m แอปหลังบ้านหยุดทำงาน (code ${code}) — พอร์ต 5173 อาจถูกใช้อยู่`);
  });
}

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (opened && adminStarted) return;
  // ตัดรหัสสีออกก่อนค้นหา URL ที่ Next พิมพ์ (Next เปลี่ยนพอร์ตเองถ้า 3000 ไม่ว่าง)
  buffer += chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
  url ??= buffer.match(/Local:\s+(https?:\/\/\S+)/)?.[1] ?? null;
  if (url && /Ready in/.test(buffer)) {
    buffer = "";
    if (!adminStarted) {
      adminStarted = true;
      startAdmin(url);
    }
    if (!opened) {
      opened = true;
      openBrowser(url);
    }
  }
});

function stopAdmin(signal) {
  if (admin && !admin.killed) admin.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAdmin(signal);
    child.kill(signal);
  });
}
child.on("exit", (code) => {
  stopAdmin("SIGTERM");
  process.exit(code ?? 0);
});
