import { eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { uploadLogs } from "@/backend/db/schema";
import { requireApiPermission } from "@/backend/lib/admin-api";
import { masterYears } from "@/backend/lib/import-workbook";

// ปีที่มีฐานข้อมูลหลัก (ใหม่ → เก่า) สำหรับตัวเลือกปีของแอปหลังบ้าน — ปีใหม่เกิดเมื่อนำเข้าไฟล์ Master ของปีนั้นครั้งแรก
// year = ปี ค.ศ. (ส่งกลับมาเป็น ?year=) · yearBE = ปี พ.ศ. ที่แสดง · file/periods = ไฟล์ Master ที่ใช้อยู่ของปีนั้น (ถ้ามี)
export async function GET() {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const [years, active] = await Promise.all([
    masterYears(db),
    db.select({ period: uploadLogs.period, periods: uploadLogs.periods, fileName: uploadLogs.fileName }).from(uploadLogs).where(eq(uploadLogs.status, "active")),
  ]);
  return Response.json(
    [...years].reverse().map((year) => {
      const file = active.find((a) => a.period.startsWith(`${year}-`));
      return {
        year,
        yearBE: year + 543,
        fileName: file?.fileName ?? null,
        periods: file ? (file.periods ? file.periods.split(",") : [file.period]) : [],
      };
    }),
  );
}
