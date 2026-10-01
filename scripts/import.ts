// นำเข้าไฟล์ Excel จาก command line: npm run import -- Data.xlsx 2026
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { parseWorkbook } from "@/lib/excel/parse";
import { importWorkbook } from "@/lib/import-workbook";

async function main() {
  const [file, yearArg] = process.argv.slice(2);
  const year = Number(yearArg);
  if (!file || !Number.isInteger(year) || year < 2000) {
    throw new Error("วิธีใช้: npm run import -- <ไฟล์.xlsx> <ปี ค.ศ.>  เช่น npm run import -- Data.xlsx 2026");
  }

  const wb = await parseWorkbook(readFileSync(file));
  console.log(`เดือน ${wb.month}/${year}: ${wb.units.length} หน่วย, ${wb.facts.length} รายการ`);
  for (const m of wb.mismatches) {
    console.warn(`  ยอดไม่ตรง ชีต ${m.sheet} บัญชี ${m.accountCode}: ในไฟล์ ${m.fileTotal} / รวมจากหน่วย ${m.sumOfUnits}`);
  }

  const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!admin) throw new Error("ยังไม่มีบัญชี admin — รัน npm run db:seed ก่อน");

  const result = await importWorkbook(db, wb, { year, userId: admin.id, fileName: path.basename(file) });
  console.log(`นำเข้างวด ${result.period} แล้ว (${result.factCount} รายการ)`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
