// นำเข้าไฟล์ Master จาก command line (แทนข้อมูลของปีนั้น ปีอื่นคงเดิม): npm run import -- <ไฟล์.xlsx> <ปี ค.ศ.>
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { importMaster, listExtraGroups, masterYearFor } from "@/backend/lib/import-workbook";
import { parseStatementWorkbook, thaiMonth } from "@/backend/lib/master-import/parse";

async function main() {
  const [file, yearArg] = process.argv.slice(2);
  const year = Number(yearArg);
  if (!file || !Number.isInteger(year) || year < 2000) {
    throw new Error('วิธีใช้: npm run import -- <ไฟล์.xlsx> <ปี ค.ศ.>  เช่น npm run import -- "PreView_ForClaude/MSP-P_Lเชียงใหม่ 2026_08.xlsx" 2026');
  }

  const data = readFileSync(file);
  const parsed = await parseStatementWorkbook(data, await listExtraGroups(db, await masterYearFor(db, year)));
  console.log(`อ่านชีตงบได้ ${parsed.months.map((m) => thaiMonth(m.month)).join(", ")} ${year} (${parsed.rowCount} ยอดราย Group)`);
  if (parsed.emptyMonths.length) console.warn(`  ข้ามเดือนที่ยอดเป็น 0 ทั้งหมด: ${parsed.emptyMonths.map(thaiMonth).join(", ")}`);
  for (const u of parsed.unknownGroups) console.warn(`  Group ใหม่ "${u.group}" ${u.name} (ยอด ${u.amount}) — นับในงบเมื่อเลือกหมวดในแอปหลังบ้านแล้ว`);
  for (const m of parsed.mismatches) console.warn(`  ! ${m.sheet} ${m.key}: ไฟล์ ${m.file} ระบบ ${m.computed}`);
  for (const u of parsed.newUnits) console.warn(`  หน่วยนอกผัง ${u.code} ${u.name} (ชีต ${u.sheet}) — นับในงบเมื่อเลือกประเภทในแอปหลังบ้านแล้ว`);
  if (parsed.missingUnits.length) console.warn(`  หน่วยในผังที่ไม่พบในไฟล์: ${parsed.missingUnits.join(", ")}`);

  const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!admin) throw new Error("ยังไม่มีบัญชี admin — รัน npm run db:seed ก่อน");

  const result = await importMaster(db, parsed, { year, userId: admin.id, fileName: path.basename(file), data });
  console.log(`นำเข้าแล้ว: ${result.periods.join(", ")} · งบที่คำนวณแล้ว ${result.lineCount} แถว`);
  const t = result.unitTree;
  console.log(`  ผังหน่วย: เพิ่ม ${t.added.length} · ลบ ${t.removed.length} (${t.removed.map((u) => u.code).join(", ") || "-"}) · แก้ ${t.updated.length}`);
  for (const b of result.backups) console.log(b.ok ? `  ✓ ย้าย ${b.fileName} ขึ้น Google Drive แล้ว` : `  ! ${b.fileName} ยังไม่ได้ backup: ${b.error}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
