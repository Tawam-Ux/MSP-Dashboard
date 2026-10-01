import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadLogs, users } from "@/db/schema";
import { formatBaht, formatPeriod } from "@/lib/format";
import { requirePermission } from "@/lib/session";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  await requirePermission("data.upload");
  const logs = await db
    .select({
      id: uploadLogs.id, period: uploadLogs.period, fileName: uploadLogs.fileName, factCount: uploadLogs.factCount,
      mismatchCount: uploadLogs.mismatchCount, createdAt: uploadLogs.createdAt, by: users.name,
    })
    .from(uploadLogs)
    .leftJoin(users, eq(users.id, uploadLogs.userId))
    .orderBy(desc(uploadLogs.id))
    .limit(20);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-3xl font-semibold">นำเข้าข้อมูล</h1>
        <p className="mt-1 mb-8 max-w-2xl text-ink-2">
          เลือกไฟล์ Excel ของเดือนที่ต้องการ ระบบจะตรวจยอดและแสดงสรุปให้ดูก่อน ข้อมูลจะยังไม่ถูกบันทึกจนกว่าจะกดนำเข้า
        </p>
        <UploadForm defaultYearBE={new Date().getFullYear() + 543} />
      </div>

      {logs.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">ประวัติการนำเข้า</h2>
          <table className="mt-3 w-full max-w-4xl text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="py-2 font-normal">เวลา</th>
                <th className="py-2 font-normal">งวด</th>
                <th className="py-2 font-normal">ไฟล์</th>
                <th className="py-2 text-right font-normal">รายการ</th>
                <th className="py-2 text-right font-normal">ยอดไม่ตรง</th>
                <th className="py-2 pl-4 font-normal">โดย</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="num py-2">{new Date(l.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="py-2">{formatPeriod(l.period)}</td>
                  <td className="py-2 break-all text-ink-2">{l.fileName}</td>
                  <td className="num py-2 text-right">{formatBaht(l.factCount)}</td>
                  <td className="num py-2 text-right">{l.mismatchCount}</td>
                  <td className="py-2 pl-4">{l.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
