"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { facts } from "@/db/schema";
import { ImportError, parseWorkbook, type Mismatch } from "@/lib/excel/parse";
import { importWorkbook, periodOf } from "@/lib/import-workbook";
import { computeStatement } from "@/lib/statement";
import { requirePermission } from "@/lib/session";

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "preview";
      period: string;
      replaces: boolean;
      unitCount: number;
      factCount: number;
      revenue: number;
      pbt: number;
      mismatches: Mismatch[];
    }
  | { status: "imported"; period: string; factCount: number };

export async function uploadWorkbook(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requirePermission("data.upload");

  const file = formData.get("file");
  const yearBE = Number(formData.get("yearBE"));
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "เลือกไฟล์ Excel (.xlsx) ก่อน" };
  if (!Number.isInteger(yearBE) || yearBE < 2543 || yearBE > 2643) {
    return { status: "error", message: "ใส่ปี พ.ศ. 4 หลัก เช่น 2569" };
  }

  let wb;
  try {
    wb = await parseWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof ImportError) return { status: "error", message: e.message };
    return { status: "error", message: "อ่านไฟล์ไม่ได้ ตรวจว่าเป็นไฟล์ .xlsx ที่เปิดใน Excel ได้" };
  }

  const year = yearBE - 543;
  if (formData.get("intent") === "import") {
    const result = await importWorkbook(db, wb, { year, userId: user.id, fileName: file.name });
    revalidatePath("/");
    return { status: "imported", ...result };
  }

  const period = periodOf(year, wb.month);
  const existing = await db.select({ p: facts.period }).from(facts).where(eq(facts.period, period)).limit(1);
  const amounts: Record<string, number> = {};
  for (const f of wb.facts) amounts[f.accountCode] = (amounts[f.accountCode] ?? 0) + Number(f.amount);
  const { totals } = computeStatement(amounts);

  return {
    status: "preview",
    period,
    replaces: existing.length > 0,
    unitCount: wb.units.length,
    factCount: wb.facts.length,
    revenue: totals.REV,
    pbt: totals.PBT,
    mismatches: wb.mismatches,
  };
}
