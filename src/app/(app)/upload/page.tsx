import { and, countDistinct, desc, eq, isNotNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { PageHeader } from "@/frontend/components/page-header";
import { db } from "@/backend/db";
import { statementLines, units, uploadLogs, users, type MasterStatus } from "@/backend/db/schema";
import { formatBaht, formatPeriodRange } from "@/backend/lib/format";
import { checkDriveFiles, driveConfig, sheetsUrl, type DriveFileState } from "@/backend/lib/google-drive";
import { hasPermission } from "@/backend/lib/authz/scope";
import { requirePermission } from "@/backend/lib/session";
import { getDraft } from "@/backend/lib/upload-draft";
import { DeleteActiveButton, DeleteLogButton } from "./delete-log-button";
import { DownloadButton } from "./download-button";
import { OpenSheetButton } from "./open-sheet-button";
import { RetryBackupButton } from "./retry-backup-button";
import { UploadForm } from "./upload-form";

const childUnits = alias(units, "child_units");

export default async function UploadPage() {
  const user = await requirePermission("data.upload");
  const logColumns = {
    id: uploadLogs.id, period: uploadLogs.period, periods: uploadLogs.periods, fileName: uploadLogs.fileName,
    sizeBytes: uploadLogs.sizeBytes, lineCount: uploadLogs.factCount, createdAt: uploadLogs.createdAt, status: uploadLogs.status,
    replacedAt: uploadLogs.replacedAt, driveFileId: uploadLogs.driveFileId, driveLink: uploadLogs.driveLink, backedUpAt: uploadLogs.backedUpAt,
    backupError: uploadLogs.backupError, by: users.name, hasLocalFile: isNotNull(uploadLogs.storedPath),
  };
  const [logs, active, unitStats, draft] = await Promise.all([
    db.select(logColumns).from(uploadLogs).leftJoin(users, eq(users.id, uploadLogs.userId)).orderBy(desc(uploadLogs.id)).limit(30),
    // ไฟล์ที่ใช้อยู่ ปีละไฟล์ เรียงปีใหม่ → เก่า (แยกจากประวัติ 30 ครั้งล่าสุด ไฟล์ปีเก่าจะได้ไม่หลุด)
    db.select(logColumns).from(uploadLogs).leftJoin(users, eq(users.id, uploadLogs.userId)).where(eq(uploadLogs.status, "active")).orderBy(desc(uploadLogs.period)),
    // นับเฉพาะหน่วยล่างสุดที่มีประเภท (สาขา/หน่วยงานจริง) — ไม่นับหน่วยรวม MSP / หน่วยงาน / Zone / Sz- / Op- ที่มีงบใน statement_lines ด้วย
    // ให้ตรงกับยอด Sales Zone + Operations ในแอปหลังบ้าน
    db
      .select({ category: units.category, n: countDistinct(statementLines.unitCode) })
      .from(statementLines)
      .innerJoin(units, eq(units.code, statementLines.unitCode))
      .where(and(isNotNull(units.category), notExists(db.select({ x: sql`1` }).from(childUnits).where(and(eq(childUnits.year, units.year), eq(childUnits.parentCode, units.code))))))
      .groupBy(units.category),
    // ไฟล์ที่ผู้ใช้อัปโหลดค้างไว้ (ตรวจแล้วยังไม่ยืนยัน) — แสดงต่อจากเดิม
    getDraft(user.id),
  ]);
  const unitsOf = (c: string) => Number(unitStats.find((s) => s.category === c)?.n ?? 0);
  const salesUnits = unitsOf("sales");
  const opsUnits = unitsOf("operations");
  const yearOf = (l: (typeof logs)[number]) => Number(l.period.slice(0, 4)) + 543;
  const periodsOf = (l: (typeof logs)[number]) => (l.periods ? l.periods.split(",") : [l.period]);
  const driveReady = driveConfig() !== null;
  const isAdmin = hasPermission(user, "users.manage");
  // ตรวจทุกไฟล์ที่มี id ใน Drive: ย้ายไป backup แล้ว หรือไฟล์ในเครื่องที่เคยอัปโหลดสำเนาไว้เปิดใน Google Sheets
  const driveStates = await checkDriveFiles(logs.flatMap((l) => (l.driveFileId ? [l.driveFileId] : [])));

  return (
    <div className="space-y-4">
      <PageHeader title="นำเข้าข้อมูล" caption="Dashboard ใช้ไฟล์ Master ปีละไฟล์ · นำเข้าไฟล์ปีเดิมซ้ำ = แทนข้อมูลปีนั้น ไฟล์เดิมย้ายไปเก็บที่ Google Drive ให้อัตโนมัติ" />

      {!driveReady && (
        <p className="panel panel-warn flex items-start gap-2.5 text-sm">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-(--warn-text)">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>
            <span className="font-semibold text-(--warn-text)">ยังไม่ได้เชื่อม Google Drive</span>
            <span className="text-ink-2"> — ไฟล์เดิมจะรอ backup ในเครื่อง ตั้งค่าด้วย <code>npm run drive:auth</code></span>
          </span>
        </p>
      )}

      <UploadForm
        defaultYearBE={new Date().getFullYear() + 543}
        draft={draft ? { name: draft.fileName, size: draft.sizeBytes, yearBE: draft.yearBE } : null}
        aside={
          <section aria-labelledby="current-title" className="card flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <h2 id="current-title" className="card-title">ไฟล์ที่ใช้อยู่</h2>
              {active.length > 0 && <span className="badge badge-good badge-dot">{active.length} ปี</span>}
            </div>
            {active.length > 0 ? (
              <>
                <ul className="mt-1">
                  {active.map((l) => (
                    <li key={l.id} className="border-b border-line py-3 last:border-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="num text-sm font-semibold text-navy">ปี {yearOf(l)}</span>
                        <span className="num text-xs text-ink-3">{formatPeriodRange(periodsOf(l))} · {periodsOf(l).length} เดือน</span>
                      </div>
                      <p className="mt-1 text-[0.8125rem] font-medium break-all text-ink">{l.fileName}</p>
                      <div className="mt-0.5 flex items-end justify-between gap-3">
                        <p className="text-xs text-ink-3">{formatTime(l.createdAt)}{l.by ? ` · ${l.by}` : ""}</p>
                        <DeleteActiveButton id={l.id} fileName={l.fileName} yearBE={yearOf(l)} />
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
                  <Fact label="หน่วยงาน (ทุกปี)" value={formatBaht(salesUnits + opsUnits)} note={`Sales ${salesUnits} · Operations ${opsUnits}`} />
                  <Fact label="แถวงบ" value={formatBaht(active.reduce((t, l) => t + l.lineCount, 0))} />
                </dl>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-3">ยังไม่มีข้อมูลในระบบ — นำเข้าไฟล์ Master ไฟล์แรกได้จากด้านซ้าย</p>
            )}
          </section>
        }
      />

      <section aria-labelledby="history-title" className="card">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="history-title" className="card-title">ประวัติการนำเข้า</h2>
          {logs.length > 0 && <span className="text-xs text-ink-3">30 ครั้งล่าสุด</span>}
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-3">ยังไม่เคยนำเข้าข้อมูล</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ไฟล์</th>
                  <th>นำเข้าเมื่อ</th>
                  <th className="text-right!">แถว</th>
                  <th>สถานะ</th>
                  <th><span className="sr-only">ดาวน์โหลด / เปิดไฟล์ / ลบ</span></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const ps = periodsOf(l);
                  const driveState: DriveFileState = l.driveFileId ? driveStates.get(l.driveFileId) ?? "unknown" : "missing";
                  // เปิดใน Google Sheets (เฉพาะผู้ดูแลระบบ): มีไฟล์ใน Drive = ลิงก์ตรง · มีแค่ในเครื่อง = ปุ่มอัปโหลดสำเนาแล้วเปิด (ต้องเชื่อม Drive)
                  const inDrive = !!l.driveFileId && driveState !== "missing";
                  const canOpen = isAdmin && (inDrive || (Boolean(l.hasLocalFile) && driveReady));
                  // ดาวน์โหลดได้เมื่อมีไฟล์ในเครื่อง (ใช้อยู่/รอ backup) หรืออยู่ใน Drive (ไม่ถูกลบ)
                  const downloadable = Boolean(l.hasLocalFile) || (l.status === "backed_up" && !!l.driveFileId && driveState !== "missing");
                  return (
                    <tr key={l.id}>
                      <td className="min-w-[14rem]">
                        <span className="block font-medium break-all text-ink">{l.fileName}</span>
                        <span className="block text-xs text-ink-3">{formatPeriodRange(ps)} · {ps.length} เดือน</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="num block text-ink-2">{formatTime(l.createdAt)}</span>
                        {l.by && <span className="block text-xs text-ink-3">{l.by}</span>}
                      </td>
                      <td className="num text-right text-ink-2">{formatBaht(l.lineCount)}</td>
                      <td><StatusCell status={l.status} id={l.id} driveState={driveState} backedUpAt={l.backedUpAt} error={l.backupError} /></td>
                      <td className="text-right">
                        <span className="inline-flex items-start justify-end gap-1.5">
                          {downloadable && <DownloadButton id={l.id} fileName={l.fileName} />}
                          {canOpen && <OpenSheetButton id={l.id} fileName={l.fileName} url={inDrive ? sheetsUrl(l.driveFileId!) : null} />}
                          <DeleteLogButton id={l.id} fileName={l.fileName} active={l.status === "active"} pendingLocal={l.status === "backup_pending"} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value, note, wide = false }: { label: string; value: string; note?: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="num mt-0.5 font-semibold text-ink">{value}</dd>
      {note && <dd className="num text-xs text-ink-3">{note}</dd>}
    </div>
  );
}

function StatusCell({ status, id, driveState, backedUpAt, error }: {
  status: MasterStatus; id: number; driveState: DriveFileState; backedUpAt: Date | null; error: string | null;
}) {
  if (status === "active") return <span className="badge badge-good badge-dot">ใช้งานอยู่</span>;
  if (status === "backed_up") {
    if (driveState === "missing") {
      return <span className="badge badge-bad badge-dot" title="ไฟล์ถูกลบหรือย้ายไปถังขยะใน Google Drive แล้ว">ไม่พบใน Drive</span>;
    }
    const movedAt = backedUpAt ? `ย้ายเมื่อ ${formatTime(backedUpAt)}` : undefined;
    return driveState === "found"
      ? <span className="badge badge-ok badge-dot" title={movedAt}>เก็บใน Drive</span>
      : <span className="badge badge-muted badge-dot" title={`ตรวจสอบไฟล์ใน Google Drive ไม่ได้ในขณะนี้${movedAt ? ` · ${movedAt}` : ""}`}>เก็บใน Drive</span>;
  }
  if (status === "backup_pending") {
    return (
      <span className="flex flex-col items-start gap-1.5">
        <span className="badge badge-warn badge-dot" title={error ?? undefined}>รอ backup</span>
        <RetryBackupButton id={id} />
      </span>
    );
  }
  return <span className="badge badge-muted badge-dot" title="นำเข้าก่อนมีระบบเก็บไฟล์ Master">ไม่มีไฟล์ต้นฉบับ</span>;
}

const formatTime = (d: Date) => new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
