// เติมภาพรวมบริษัท (ชีต Monthy → ตาราง company_monthly) จากไฟล์ Master ที่ใช้งานอยู่ของทุกปี
// ใช้ครั้งเดียวหลังเพิ่มหน้า Overview แบบใหม่ — ไฟล์ที่นำเข้าหลังจากนี้เขียนตารางนี้เองตอนนำเข้า: npx tsx scripts/backfill-monthy.ts
import "dotenv/config";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db, pool } from "@/backend/db";
import { uploadLogs } from "@/backend/db/schema";
import { listExtraGroups, replaceCompanyMonthly } from "@/backend/lib/import-workbook";
import { computeTotals } from "@/backend/lib/master-import/compute";
import { parseMonthySheet } from "@/backend/lib/master-import/monthy";
import { thaiMonth } from "@/backend/lib/master-import/parse";
import { readMasterFile } from "@/backend/lib/master-storage";

async function main() {
  const active = await db.select().from(uploadLogs).where(eq(uploadLogs.status, "active"));
  if (active.length === 0) console.log("ไม่มีไฟล์ Master ที่ใช้งานอยู่");
  for (const log of active) {
    const year = Number(log.period.slice(0, 4));
    if (!log.storedPath) {
      console.warn(`${year}: ${log.fileName} ไม่มีไฟล์ในเครื่อง — ข้าม (นำเข้าไฟล์ใหม่แทน)`);
      continue;
    }
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await readMasterFile(log.storedPath)) as unknown as ArrayBuffer);
    const extra = await listExtraGroups(db, year);
    const monthy = parseMonthySheet(book, extra);
    if (!monthy) {
      console.warn(`${year}: ${log.fileName} ไม่มีชีต Monthy — คงค่าเดิม`);
      continue;
    }
    await db.transaction((tx) => replaceCompanyMonthly(tx, year, monthy.months));
    console.log(`${year}: ${log.fileName} ชีต ${monthy.sheet} · ${monthy.months.map((m) => thaiMonth(m.month)).join(", ")}`);
    for (const m of monthy.months) {
      const t = computeTotals(m.groups, extra);
      console.log(`  ${thaiMonth(m.month)} รายได้รวม ${t.REV.toFixed(2)} · กำไรก่อนภาษี ${t.PBT.toFixed(2)}`);
    }
    for (const m of monthy.mismatches) console.warn(`  ! ${thaiMonth(m.month)} ${m.key}: ชีต ${m.file} ระบบ ${m.computed}`);
    for (const i of monthy.issues) console.warn(`  ! ${i}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
