"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/backend/db";
import { branchAreas, detectedGroups, detectedUnits, facts, groupAmounts, totalOverrides, uploadLogs } from "@/backend/db/schema";
import {
  currentUnitTree, fileTotalTargets, importMaster, inYear, listExtraGroups, masterYearFor, masterYears, previewUnitTree, recomputeStatements, removedWithData,
  type FileTotal,
} from "@/backend/lib/import-workbook";
import { computeTotals, rollup, type ExtraGroup } from "@/backend/lib/master-import/compute";
import type { MonthyMismatch } from "@/backend/lib/master-import/monthy";
import { ImportError, parseStatementWorkbook, type DetectedUnit, type Mismatch, type ParsedStatement } from "@/backend/lib/master-import/parse";
import { ROOT_CODE, type UnitTreeChange } from "@/backend/lib/master-import/units";
import { backupPendingMasters, type BackupResult } from "@/backend/lib/master-backup";
import { removeMasterFile } from "@/backend/lib/master-storage";
import { diffBranchAreas, type AreaChange } from "@/backend/lib/sales-benchmark";
import { requirePermission } from "@/backend/lib/session";
import { clearDraft, getDraft, readDraftFile, saveDraft, setDraftYear } from "@/backend/lib/upload-draft";

/** สรุปของแต่ละเดือนจากการคำนวณที่ backend — ให้ผู้ใช้เทียบกับ Excel ก่อนยืนยัน */
export type MonthSummary = { month: number; unitCount: number; rev: number; gp: number; op: number; pbt: number };
/** การเปลี่ยนผังหน่วยแบบย่อ (ส่งไปหน้าเว็บ) */
export type TreeChangeSummary = { added: string[]; removed: string[]; updated: string[] };

export type PreviewData = {
  fileName: string;
  sizeBytes: number;
  rowCount: number;
  months: MonthSummary[];
  emptyMonths: number[];
  /** Group ใหม่ที่ยังไม่เลือกหมวด — ยังไม่นับในงบ · isNew = ยังไม่เคยพบ (ไม่ใช่ที่รออยู่แล้ว) */
  unknownGroups: { group: string; name: string; amount: number; isNew: boolean }[];
  /** ลิงก์หน้า Group ใหม่ในแอปหลังบ้าน (ตั้ง ADMIN_APP_URL) */
  pendingGroupsUrl: string | null;
  /** ยอดไม่ตรง + หน่วยในผังที่ยอดรวมตามไฟล์จะไปใช้ ถ้าเลือก "ใช้ยอดรวมตามไฟล์" (ว่าง = ไม่มีหน่วยที่ตรงกับชีต) */
  mismatches: (Omit<Mismatch, "leaves"> & { targets: { code: string; name: string }[] })[];
  /** หน่วยนอกผังในโค้ดที่ยังไม่ได้เลือกประเภท (ใหม่ หรือรออยู่แล้ว) — ยังไม่นับในงบ */
  pendingUnits: (DetectedUnit & { isNew: boolean })[];
  missingUnits: string[];
  unitTree: TreeChangeSummary;
  /** ไฟล์ที่ใช้งานอยู่ ปีละไฟล์ (ใหม่ → เก่า) — หน้าเว็บบอกว่าไฟล์นี้จะแทนไฟล์ปีไหน ตามปี พ.ศ. ที่เลือก */
  activeFiles: { yearBE: number; fileName: string }[];
  /** ปี พ.ศ. ที่มีข้อมูลหลักแล้ว — ปีอื่นนำเข้าแล้วจะเริ่มจากสำเนาของปีต้นแบบ */
  masterYearsBE: number[];
  /** ชีต Branch_Area (พื้นที่ ตร.ม.) · null = ไฟล์ไม่มีชีตนี้ — นำเข้าแล้วใช้ ตร.ม. ชุดเดิม (savedCount = จำนวนที่บันทึกไว้ตอนนี้) */
  areaSheet: { count: number; issues: string[]; unknownCodes: string[] } | null;
  savedAreaCount: number;
  /** ตร.ม. ที่จะเปลี่ยนจากชุดที่ใช้อยู่ (ว่าง = ไม่มีชีต หรือไม่ต่าง) · basisPeriod = เดือนล่าสุดของไฟล์ที่ใช้อยู่ ("2026-08-01") */
  areaChanges: AreaChange[];
  areaBasisPeriod: string | null;
  /**
   * ชีต Monthy (ภาพรวมบริษัทของหน้า Overview) · null = ไฟล์ไม่มีชีตนี้ — นำเข้าแล้ว Overview ใช้ข้อมูลชุดเดิมของปีนั้น
   * mismatches = แถวยอดรวมในชีตไม่ตรงกับที่คิดจากยอดราย Group · diffs = ยอดของ Monthy ไม่ตรงกับงบรวมจากชีตรายเดือน
   */
  monthy: {
    sheet: string;
    months: number[];
    emptyMonths: number[];
    mismatches: MonthyMismatch[];
    diffs: { month: number; key: "REV" | "GP" | "OP" | "PBT"; monthy: number; master: number }[];
    /** เดือนที่ชีตรายเดือนมีตัวเลข แต่ชีต Monthy ไม่มี */
    missingMonths: number[];
    issues: string[];
  } | null;
};

export type PreviewResult = { ok: true; data: PreviewData } | { ok: false; message: string };
export type ImportResult =
  | { ok: true; periods: string[]; lineCount: number; unitTree: TreeChangeSummary; backups: BackupResult[] }
  | { ok: false; message: string };

const summarize = (c: UnitTreeChange): TreeChangeSummary => ({
  added: c.added.map((u) => u.code),
  removed: c.removed.map((u) => u.code),
  updated: c.updated.map((u) => u.code),
});

/** อ่านไฟล์ด้วย Group ใหม่ที่เลือกหมวดแล้วของปีนั้น (ปีที่ยังไม่มีข้อมูลหลัก = ของปีต้นแบบที่จะถูกคัดลอก) */
async function parseFile(fileName: string, data: Buffer, year: number): Promise<{ parsed: ParsedStatement } | { error: string }> {
  try {
    return { parsed: await parseStatementWorkbook(data, await listExtraGroups(db, await masterYearFor(db, year))) };
  } catch (e) {
    if (e instanceof ImportError) return { error: e.message };
    console.error("[upload] อ่านไฟล์ไม่ได้:", fileName, e);
    return { error: `อ่านไฟล์ไม่ได้ (${e instanceof Error ? e.message : String(e)}) — ตรวจว่าเป็นไฟล์ .xlsx ที่เปิดใน Excel ได้` };
  }
}

const validYear = (y: number) => Number.isInteger(y) && y >= 2543 && y <= 2643;
/** ปี พ.ศ. ที่ใช้ตรวจไฟล์ (ไม่ถูกต้อง = ปีปัจจุบัน) → ปี ค.ศ. */
const yearOf = (yearBE: number) => (validYear(yearBE) ? yearBE : new Date().getFullYear() + 543) - 543;

/**
 * อ่านไฟล์ที่เลือกและคำนวณสรุปให้ตรวจ — ไฟล์ที่อ่านได้ถูกเก็บเป็นไฟล์ค้างของผู้ใช้ (upload-draft)
 * ยังไม่แตะข้อมูลของ Dashboard จนกว่าจะกดยืนยัน
 */
export async function previewUpload(formData: FormData): Promise<PreviewResult> {
  const user = await requirePermission("data.upload");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "เลือกไฟล์ Excel (.xlsx) ก่อน" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, message: "รองรับเฉพาะไฟล์ .xlsx" };
  const data = Buffer.from(await file.arrayBuffer());
  const yearBE = Number(formData.get("yearBE"));
  const read = await parseFile(file.name, data, yearOf(yearBE));
  if ("error" in read) {
    // เลือกไฟล์ใหม่ = แทนไฟล์ค้างเดิม แม้ไฟล์ใหม่อ่านไม่ได้ (กลับมาหน้านี้ต้องไม่เจอไฟล์เก่าโผล่ขึ้นมา)
    await clearDraft(user.id);
    return { ok: false, message: read.error };
  }

  await saveDraft(user.id, { fileName: file.name, sizeBytes: file.size, yearBE: yearOf(yearBE) + 543 }, data);
  return { ok: true, data: await buildPreview(file.name, file.size, read.parsed, yearOf(yearBE)) };
}

export type DraftResult = { ok: true; data: PreviewData; yearBE: number } | { ok: false; message: string } | null;

/** เปิดหน้าอัปโหลดอีกครั้ง / เปลี่ยนปีของไฟล์: ตรวจไฟล์ค้างของผู้ใช้ใหม่ด้วยข้อมูลหลักของปีนั้น · ไม่มีไฟล์ค้าง = null */
export async function previewDraft(): Promise<DraftResult> {
  const user = await requirePermission("data.upload");
  const [draft, data] = await Promise.all([getDraft(user.id), readDraftFile(user.id)]);
  if (!draft || !data) return null;
  const read = await parseFile(draft.fileName, data, yearOf(draft.yearBE));
  if ("error" in read) return { ok: false, message: read.error };
  return { ok: true, data: await buildPreview(draft.fileName, draft.sizeBytes, read.parsed, yearOf(draft.yearBE)), yearBE: draft.yearBE };
}

/** จำปี พ.ศ. ที่แก้ไว้กับไฟล์ค้าง */
export async function rememberDraftYear(yearBE: number) {
  const user = await requirePermission("data.upload");
  if (validYear(yearBE)) await setDraftYear(user.id, yearBE);
}

/** ยกเลิกไฟล์ค้าง (กดยกเลิก / นำเข้าไฟล์อื่น) */
export async function discardDraft() {
  const user = await requirePermission("data.upload");
  await clearDraft(user.id);
}

/**
 * สรุปให้ตรวจก่อนนำเข้าเป็นไฟล์ของปี year — ใช้ข้อมูลหลักของปีนั้น (ยังไม่มี = ของปีต้นแบบที่จะถูกคัดลอกตอนนำเข้า)
 * อ่านอย่างเดียว ไม่สร้างข้อมูลหลักของปีใหม่
 */
async function buildPreview(fileName: string, sizeBytes: number, parsed: ParsedStatement, year: number): Promise<PreviewData> {
  const src = await masterYearFor(db, year);
  // ผังที่จะใช้หลังนำเข้า = ผังในโค้ด + หน่วยใหม่ที่เลือกประเภทแล้ว → ยอดของหน่วยบนสุดคือยอดที่นับในงบ
  const tree = await currentUnitTree(db, src);
  const [extra, seenGroups] = await Promise.all([
    listExtraGroups(db, src),
    db.select({ code: detectedGroups.code }).from(detectedGroups).where(eq(detectedGroups.year, src)),
  ]);
  const inTree = new Set(tree.map((u) => u.code));
  const months = parsed.months.map(({ month, units: byUnit }) => {
    const t = computeTotals(rollup(tree, byUnit).get(ROOT_CODE) ?? {}, extra);
    return { month, unitCount: [...byUnit.keys()].filter((c) => inTree.has(c)).length, rev: t.REV, gp: t.GP, op: t.OP, pbt: t.PBT };
  });
  const known = new Set((await db.select({ code: detectedUnits.code }).from(detectedUnits).where(eq(detectedUnits.year, src))).map((d) => d.code));
  // รวมหน่วยในโค้ดที่ผู้ดูแลลบออกแต่ไฟล์ยังมียอด (นำเข้าแล้วจะไปรอที่หน้า หน่วยงานใหม่)
  const pendingUnits = [...parsed.newUnits, ...(await removedWithData(db, src, parsed))]
    .filter((u) => !inTree.has(u.code))
    .map((u) => ({ ...u, isNew: !known.has(u.code) }));

  const active = await db
    .select({ fileName: uploadLogs.fileName, period: uploadLogs.period })
    .from(uploadLogs)
    .where(eq(uploadLogs.status, "active"))
    .orderBy(desc(uploadLogs.period));
  const savedAreas = await db.select().from(branchAreas).where(eq(branchAreas.year, src));
  const savedAreaCount = savedAreas.length;
  const areaChanges = parsed.areas
    ? diffBranchAreas(savedAreas.map((a) => ({ code: a.unitCode, name: a.name, area: Number(a.areaSqm), source: a.source })), parsed.areas)
    : [];
  return {
    fileName,
    sizeBytes,
    rowCount: parsed.rowCount,
    months,
    emptyMonths: parsed.emptyMonths,
    unknownGroups: parsed.unknownGroups.map((g) => ({ ...g, isNew: !seenGroups.some((s) => s.code === g.group) })),
    pendingGroupsUrl: process.env.ADMIN_APP_URL ? `${process.env.ADMIN_APP_URL.replace(/\/$/, "")}/#/pending-groups` : null,
    mismatches: fileTotalTargets(tree, parsed, fileTotalsOf(parsed)).map((t, i) => {
      const { month, sheet, unitCode, key, file, computed } = parsed.mismatches[i];
      const targets = t.unitCodes.map((code) => ({ code, name: tree.find((u) => u.code === code)?.name ?? code }));
      return { month, sheet, unitCode, key, file, computed, targets };
    }),
    pendingUnits,
    missingUnits: parsed.missingUnits,
    unitTree: summarize(await previewUnitTree(db, src)),
    activeFiles: active.map((a) => ({ yearBE: Number(a.period.slice(0, 4)) + 543, fileName: a.fileName })),
    masterYearsBE: (await masterYears(db)).map((y) => y + 543),
    // รหัสสาขาในชีต Branch_Area ที่ไม่อยู่ในผังหน่วย — บันทึกไว้แต่ไม่ถูกใช้คิดเกณฑ์จนกว่าจะมีหน่วยรหัสนั้น
    areaSheet: parsed.areas
      ? { count: parsed.areas.length, issues: parsed.areaIssues, unknownCodes: parsed.areas.filter((a) => !inTree.has(a.code)).map((a) => a.code) }
      : null,
    savedAreaCount,
    areaChanges,
    areaBasisPeriod: active.find((a) => a.period.startsWith(`${src}-`))?.period ?? null,
    monthy: monthyCheck(parsed, months, extra),
  };
}

const MONTHY_KEYS = [["REV", "rev"], ["GP", "gp"], ["OP", "op"], ["PBT", "pbt"]] as const;

/** ตรวจชีต Monthy: ยอดรวมของแต่ละเดือนต้องตรงกับงบรวม (หน่วยบนสุด) ที่คิดจากชีตรายเดือน */
function monthyCheck(parsed: ParsedStatement, months: MonthSummary[], extra: ExtraGroup[]): PreviewData["monthy"] {
  const m = parsed.monthy;
  if (!m) return null;
  const diffs: NonNullable<PreviewData["monthy"]>["diffs"] = [];
  for (const { month, groups } of m.months) {
    const master = months.find((s) => s.month === month);
    if (!master) continue;
    const t = computeTotals(groups, extra);
    for (const [key, field] of MONTHY_KEYS) {
      if (Math.abs(t[key] - master[field]) > 0.01) diffs.push({ month, key, monthy: t[key], master: master[field] });
    }
  }
  return {
    sheet: m.sheet,
    months: m.months.map((x) => x.month),
    emptyMonths: m.emptyMonths,
    mismatches: m.mismatches,
    diffs,
    missingMonths: months.map((s) => s.month).filter((mo) => !m.months.some((x) => x.month === mo)),
    issues: m.issues,
  };
}

/** ยอดรวมตามไฟล์ของทุกชีตที่ไม่ตรงกับที่ระบบคำนวณ (ลำดับเดียวกับ parsed.mismatches) */
const fileTotalsOf = (parsed: ParsedStatement): FileTotal[] =>
  parsed.mismatches.map((m) => ({ month: m.month, leaves: m.leaves, key: m.key, amount: m.file }));

/**
 * นำเข้าไฟล์ค้างของผู้ใช้เป็นไฟล์ Master ของปีที่เลือก (แทนข้อมูลปีนั้น ปีอื่นคงเดิม) — คำนวณงบทุกหน่วยเก็บไว้ที่ backend
 * totalsSource = "file" → ชีตที่ยอดไม่ตรง ใช้ยอดรวมตามไฟล์แทนยอดที่ระบบคำนวณ · อื่นๆ = ใช้ยอดที่ระบบคำนวณ
 */
export async function importUpload(formData: FormData): Promise<ImportResult> {
  const user = await requirePermission("data.upload");
  const yearBE = Number(formData.get("yearBE"));
  if (!validYear(yearBE)) return { ok: false, message: "ใส่ปี พ.ศ. 4 หลัก เช่น 2569" };
  const useFileTotals = formData.get("totalsSource") === "file";

  const [draft, data] = await Promise.all([getDraft(user.id), readDraftFile(user.id)]);
  if (!draft || !data) return { ok: false, message: "ไม่พบไฟล์ที่อัปโหลดค้างไว้ — เลือกไฟล์ใหม่อีกครั้ง" };
  const read = await parseFile(draft.fileName, data, yearBE - 543);
  if ("error" in read) return { ok: false, message: read.error };

  try {
    const result = await importMaster(db, read.parsed, {
      year: yearBE - 543,
      userId: user.id,
      fileName: draft.fileName,
      data,
      fileTotals: useFileTotals ? fileTotalsOf(read.parsed) : undefined,
    });
    await clearDraft(user.id);
    revalidatePath("/", "layout");
    return {
      ok: true,
      periods: result.periods,
      lineCount: result.lineCount,
      unitTree: summarize(result.unitTree),
      backups: result.backups,
    };
  } catch (e) {
    console.error("[upload] นำเข้าไม่สำเร็จ:", draft.fileName, e);
    const cause = (e as { cause?: { message?: string } })?.cause?.message ?? (e instanceof Error ? e.message : String(e));
    return { ok: false, message: `บันทึกข้อมูลไม่สำเร็จ — ข้อมูลเดิมยังอยู่ครบ (${cause.slice(0, 200)})` };
  }
}

export type DeleteLogState = { status: "idle" } | { status: "error"; message: string };

/**
 * ลบไฟล์ที่ใช้งานอยู่ของปีหนึ่ง (การ์ด ไฟล์ที่ใช้อยู่): ลบข้อมูลของปีนั้นใน Dashboard (ยอดต่อ Group + งบที่คำนวณแล้ว) · ปีอื่นไม่เปลี่ยน
 * keepFile = เก็บไฟล์ไว้ในประวัติแล้วย้ายขึ้น Google Drive (เหมือนตอนถูกแทนด้วยไฟล์ใหม่) · ไม่เก็บ = ลบแถวประวัติและไฟล์ในเครื่องทิ้ง
 * ผังหน่วย/หน่วยใหม่ที่ตรวจพบ/ค่าที่แก้ไว้ไม่ถูกลบ
 */
export async function deleteActiveMaster(_prev: DeleteLogState, formData: FormData): Promise<DeleteLogState> {
  await requirePermission("data.upload");
  const keepFile = formData.get("keepFile") === "on";
  const id = Number(formData.get("id"));
  const [log] = Number.isInteger(id) && id > 0
    ? await db.select().from(uploadLogs).where(and(eq(uploadLogs.id, id), eq(uploadLogs.status, "active"))).limit(1)
    : [];
  if (!log) return { status: "error", message: "ไม่พบไฟล์ที่ใช้งานอยู่ (อาจถูกลบหรือถูกแทนไปแล้ว)" };
  const year = Number(log.period.slice(0, 4));

  try {
    await db.transaction(async (tx) => {
      await tx.delete(groupAmounts).where(inYear(groupAmounts.period, year));
      await tx.delete(totalOverrides).where(inYear(totalOverrides.period, year));
      await tx.delete(facts).where(inYear(facts.period, year));
      // งบและเกณฑ์ยอดขายต่อ ตร.ม. ของปีนี้คำนวณใหม่จากยอดที่เหลือ (ไม่มีแล้ว) — งบของปีที่ลบหายไปเอง · ข้อมูลหลักของปีนี้ยังเก็บไว้
      await recomputeStatements(tx, [year]);
      if (!keepFile) await tx.delete(uploadLogs).where(eq(uploadLogs.id, log.id));
      else await tx.update(uploadLogs).set({ status: log.storedPath ? "backup_pending" : "no_file", replacedAt: new Date() }).where(eq(uploadLogs.id, log.id));
    });
  } catch (e) {
    console.error("[upload] ลบข้อมูลไม่สำเร็จ:", log.fileName, e);
    return { status: "error", message: "ลบข้อมูลไม่สำเร็จ — ข้อมูลเดิมยังอยู่ครบ" };
  }

  if (log.storedPath) {
    if (keepFile) await backupPendingMasters(db, [log.id]); // backup ไม่สำเร็จ = รอในเครื่อง กดส่งใหม่ได้จากประวัติ
    else await removeMasterFile(log.storedPath).catch((e) => console.error("[upload] ลบไฟล์ในเครื่องไม่สำเร็จ:", log.storedPath, e));
  }
  revalidatePath("/", "layout");
  return { status: "idle" };
}

/**
 * ลบแถวในประวัติการนำเข้า (ไม่ใช่ไฟล์ที่ใช้งานอยู่) — ลบไฟล์ที่ยังค้างในเครื่องด้วย (กรณีรอ backup)
 * ไฟล์ที่ย้ายขึ้น Google Drive แล้วไม่ถูกลบ · ไม่กระทบข้อมูลใน Dashboard
 */
export async function deleteUploadLog(_prev: DeleteLogState, formData: FormData): Promise<DeleteLogState> {
  await requirePermission("data.upload");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "ไม่พบรายการ" };
  const [log] = await db.select().from(uploadLogs).where(eq(uploadLogs.id, id));
  if (!log) return { status: "error", message: "ไม่พบรายการ (อาจถูกลบไปแล้ว)" };
  if (log.status === "active") return { status: "error", message: "ลบไฟล์ที่ใช้งานอยู่ไม่ได้ — นำเข้าไฟล์ใหม่แทนก่อน" };

  await db.delete(uploadLogs).where(eq(uploadLogs.id, id));
  if (log.storedPath) await removeMasterFile(log.storedPath).catch((e) => console.error("[upload] ลบไฟล์ในเครื่องไม่สำเร็จ:", log.storedPath, e));
  revalidatePath("/upload");
  return { status: "idle" };
}

export type RetryState = { status: "idle" } | { status: "done"; results: BackupResult[] };

/** ลองส่งไฟล์ที่รอ backup ขึ้น Google Drive อีกครั้ง (ไม่ระบุ id = ทุกไฟล์ที่รออยู่) */
export async function retryBackup(_prev: RetryState, formData: FormData): Promise<RetryState> {
  await requirePermission("data.upload");
  const id = Number(formData.get("id"));
  const results = await backupPendingMasters(db, Number.isInteger(id) && id > 0 ? [id] : undefined);
  revalidatePath("/upload");
  return { status: "done", results };
}
