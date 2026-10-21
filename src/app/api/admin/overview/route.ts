import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { roles, uploadLogs, users } from "@/backend/db/schema";
import { requestYear, requireApiPermission } from "@/backend/lib/admin-api";
import { detectedGroupRows } from "@/backend/lib/admin-groups";
import { detectedRows, unitListRows } from "@/backend/lib/admin-units";
import { inYear, listZones } from "@/backend/lib/import-workbook";
import { listAdminUsers } from "@/backend/lib/users";

// หน้า Dashboard ของแอปหลังบ้าน: ยอดรวมของทุกเมนูในคำขอเดียว (ผู้ใช้ บทบาท หน่วยงาน หน่วยงานใหม่ ไฟล์ Master)
// หน่วยงาน/หน่วยงานใหม่/Group ใหม่/ไฟล์ Master = ของปีที่เลือก (?year=) · ผู้ใช้/บทบาท/ไฟล์รอ backup = ทุกปี
export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  const year = await requestYear(req);
  if (year instanceof Response) return year;

  // listZones ก่อน: ทำให้แน่ใจว่าข้อมูลหลักของปีนี้พร้อม ก่อนคำขออื่นอ่านพร้อมกัน
  const zoneList = await listZones(db, year);
  const [userRows, roleRows, unitRows, detected, [master], pendingBackups, groups] = await Promise.all([
    listAdminUsers(),
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.id),
    unitListRows(year),
    detectedRows(year),
    db
      .select({
        fileName: uploadLogs.fileName, createdAt: uploadLogs.createdAt, period: uploadLogs.period, periods: uploadLogs.periods,
        lineCount: uploadLogs.factCount, by: users.name,
      })
      .from(uploadLogs)
      .leftJoin(users, eq(users.id, uploadLogs.userId))
      .where(and(eq(uploadLogs.status, "active"), inYear(uploadLogs.period, year)))
      .orderBy(desc(uploadLogs.id))
      .limit(1),
    db.select({ id: uploadLogs.id }).from(uploadLogs).where(eq(uploadLogs.status, "backup_pending")),
    detectedGroupRows(year),
  ]);

  // นับเฉพาะหน่วยที่มีข้อมูลในปีนี้ — ผังของปีคัดลอกมาจากปีอื่น จึงมีหน่วยที่ไม่มีข้อมูลในปีนี้ปนอยู่
  const leaves = unitRows.filter((u) => !u.hasChildren && u.category && u.hasData);
  const pending = detected.filter((d) => d.category === null && d.hasData);

  // โซนตามลำดับในโค้ด · หน่วยที่ไม่มีโซนรวมไว้ท้ายสุด
  // นับตามหน้าที่แสดง (ประเภทที่ผู้ดูแลเพิ่มนับรวมในหน้าที่เลือกไว้)
  const zoneOf = (code: string | null) => zoneList.find((z) => z.code === code)?.name ?? "ไม่ระบุโซน";
  const byZone = new Map<string, { zone: string; sales: number; operations: number }>(
    zoneList.map((z) => [z.name, { zone: z.name, sales: 0, operations: 0 }]),
  );
  for (const u of leaves) {
    const name = zoneOf(u.zoneCode);
    const row = byZone.get(name) ?? { zone: name, sales: 0, operations: 0 };
    if (u.page === "sales") row.sales++;
    else if (u.page === "operations") row.operations++;
    byZone.set(name, row);
  }

  return Response.json({
    users: {
      total: userRows.length,
      active: userRows.filter((u) => u.isActive).length,
      sso: userRows.filter((u) => u.authProvider !== "local").length,
      // ผู้ใช้ที่เปิดใช้งานแต่ไม่มีบทบาท = เข้าระบบได้แต่ไม่เห็นอะไร
      noRole: userRows.filter((u) => u.isActive && u.roleIds.length === 0).length,
      byRole: roleRows.map((r) => ({ id: r.id, name: r.name, count: userRows.filter((u) => u.roleIds.includes(r.id)).length })),
      recent: [...userRows]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5)
        .map(({ id, name, username, isActive, createdAt }) => ({ id, name, username, isActive, createdAt })),
    },
    units: {
      sales: leaves.filter((u) => u.page === "sales").length,
      operations: leaves.filter((u) => u.page === "operations").length,
      byZone: [...byZone.values()].filter((z) => z.sales + z.operations > 0),
    },
    pending: {
      total: pending.length,
      noZone: pending.filter((d) => !d.zoneCode).length,
      latest: [...pending]
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
        .slice(0, 5)
        .map((d) => ({ id: d.code, name: d.name, sheet: d.sheet, zoneName: d.zoneName, detectedAt: d.detectedAt.toISOString() })),
    },
    master: master
      ? {
          fileName: master.fileName,
          createdAt: master.createdAt.toISOString(),
          by: master.by,
          periods: master.periods ? master.periods.split(",") : [master.period],
          lineCount: master.lineCount,
        }
      : null,
    backupPending: pendingBackups.length,
    // Group ใหม่ที่รอเลือกหมวด (ยอดยังไม่นับในงบ)
    pendingGroups: groups.filter((g) => g.section === null).length,
  });
}
