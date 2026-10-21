// ถอด / ใส่คืน ฟีเจอร์ "รายละเอียดรายการในงบ" (ป๊อปอัปบัญชีย่อยจากชีต MASTER_ ในการ์ดงบกำไรขาดทุนของรายละเอียดสาขา)
//
//   node scripts/account-detail-feature.mjs status   ดูว่าตอนนี้ใส่อยู่หรือถอดแล้ว
//   node scripts/account-detail-feature.mjs remove   ถอดออก — ไฟล์กลับเป็นแบบก่อนสร้างฟีเจอร์
//   node scripts/account-detail-feature.mjs add      ใส่ฟีเจอร์กลับคืน
//
// ไฟล์ทั้งสองแบบเก็บใน scripts/feature-backups/account-detail/ (before = ก่อนสร้าง, after = มีฟีเจอร์)
// ถ้าไฟล์ที่แก้ร่วมถูกแก้ต่อหลังจากนั้น สคริปต์จะไม่เขียนทับ (กันงานหาย) — เพิ่ม --force ถ้าต้องการเขียนทับจริง
// ปิดชั่วคราวโดยไม่ถอด: ตั้ง ACCOUNT_DETAIL_ENABLED = false ใน src/backend/lib/account-detail.ts

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const store = path.join(root, "scripts", "feature-backups", "account-detail");
const manifestPath = path.join(store, "manifest.json");

/** ไฟล์เดิมที่ฟีเจอร์แก้ (มีทั้งแบบ before/after) และไฟล์ใหม่ของฟีเจอร์ (มีเฉพาะ after) */
const TOUCHED = [
  "src/frontend/components/statement-table.tsx",
  "src/frontend/components/unit-detail.tsx",
  "src/app/(app)/zones/page.tsx",
  "src/app/(app)/operations/page.tsx",
];
const ADDED = [
  "src/backend/lib/account-detail.ts",
  "src/app/api/account-detail/route.ts",
  "src/frontend/components/account-detail.tsx",
];

// เก็บเป็น .bak ชื่อแบน — ไม่ให้ tsc / eslint / Next อ่านสำเนาเป็นโค้ด
const bak = (kind, rel) => path.join(store, kind, `${rel.replace(/[\\/()]/g, "_")}.bak`);
const abs = (rel) => path.join(root, rel);
const hash = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null);

const [cmd, ...flags] = process.argv.slice(2);
const force = flags.includes("--force");

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
}

/** สถานะปัจจุบันของไฟล์ที่แก้ร่วม: ตรงกับ before / after / ถูกแก้ต่อ */
function state(manifest) {
  return TOUCHED.map((rel) => {
    const h = hash(abs(rel));
    return { rel, is: h === manifest.after[rel] ? "after" : h === manifest.before[rel] ? "before" : "edited" };
  });
}

if (cmd === "snapshot") {
  // ใช้ครั้งเดียวตอนสร้างฟีเจอร์เสร็จ: เก็บแบบ after + ลายนิ้วมือของทั้งสองแบบ
  const manifest = { before: {}, after: {} };
  for (const rel of TOUCHED) {
    if (!existsSync(bak("before", rel))) throw new Error(`ไม่มีสำเนาก่อนสร้างของ ${rel}`);
    manifest.before[rel] = hash(bak("before", rel));
  }
  for (const rel of [...TOUCHED, ...ADDED]) {
    copy(abs(rel), bak("after", rel));
    manifest.after[rel] = hash(abs(rel));
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("บันทึกแบบมีฟีเจอร์แล้ว");
} else if (cmd === "status" || cmd === "remove" || cmd === "add") {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const files = state(manifest);
  const added = ADDED.filter((rel) => existsSync(abs(rel))).length;

  if (cmd === "status") {
    for (const f of files) console.log(`${f.is.padEnd(7)} ${f.rel}`);
    console.log(`ไฟล์ใหม่ของฟีเจอร์ที่มีอยู่ ${added}/${ADDED.length}`);
    process.exit(0);
  }

  const target = cmd === "remove" ? "before" : "after";
  const blocked = files.filter((f) => f.is === "edited");
  if (blocked.length && !force) {
    console.error(`ไฟล์ต่อไปนี้ถูกแก้หลังสร้างฟีเจอร์ — ไม่เขียนทับเพื่อกันงานหาย (ใส่ --force ถ้าต้องการเขียนทับ):`);
    for (const f of blocked) console.error(`  ${f.rel}`);
    process.exit(1);
  }
  for (const f of files) if (f.is !== target) copy(bak(target, f.rel), abs(f.rel));
  for (const rel of ADDED) {
    if (cmd === "remove") rmSync(abs(rel), { force: true });
    else copy(bak("after", rel), abs(rel));
  }
  // โฟลเดอร์ route ว่างหลังถอด
  if (cmd === "remove") rmSync(abs("src/app/api/account-detail"), { recursive: true, force: true });
  console.log(cmd === "remove" ? "ถอดฟีเจอร์แล้ว — ไฟล์กลับเป็นแบบก่อนสร้าง" : "ใส่ฟีเจอร์กลับคืนแล้ว");
} else {
  console.log("ใช้: node scripts/account-detail-feature.mjs <status|remove|add> [--force]");
  process.exit(1);
}
