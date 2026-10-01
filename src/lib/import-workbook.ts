import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { accounts, facts, unitClosure, units, uploadLogs } from "@/db/schema";
import { buildClosure } from "./authz/scope";
import type { ParsedWorkbook } from "./excel/parse";
import { ACCOUNTS } from "./statement";

export const periodOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

const CHUNK = 1000;

/** เขียนข้อมูลงวดนี้ทับของเดิมทั้งหมดใน transaction เดียว */
export async function importWorkbook(
  db: Db,
  wb: ParsedWorkbook,
  opts: { year: number; userId: number; fileName: string },
): Promise<{ period: string; factCount: number }> {
  const period = periodOf(opts.year, wb.month);

  await db.transaction(async (tx) => {
    await syncAccounts(tx);

    for (const u of wb.units) {
      await tx.insert(units).values(u).onDuplicateKeyUpdate({
        set: { name: u.name, parentCode: u.parentCode, level: u.level, sortOrder: u.sortOrder },
      });
    }
    const allUnits = await tx.select({ code: units.code, parentCode: units.parentCode }).from(units);
    await tx.delete(unitClosure);
    const closure = buildClosure(allUnits);
    for (let i = 0; i < closure.length; i += CHUNK) await tx.insert(unitClosure).values(closure.slice(i, i + CHUNK));

    await tx.delete(facts).where(eq(facts.period, period));
    const rows = wb.facts.map((f) => ({ ...f, period }));
    for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(facts).values(rows.slice(i, i + CHUNK));

    await tx.insert(uploadLogs).values({
      userId: opts.userId, period, fileName: opts.fileName, factCount: rows.length, mismatchCount: wb.mismatches.length,
    });
  });

  return { period, factCount: wb.facts.length };
}

export async function syncAccounts(db: Pick<Db, "insert">) {
  for (const [i, a] of ACCOUNTS.entries()) {
    await db.insert(accounts).values({ ...a, sortOrder: i }).onDuplicateKeyUpdate({
      set: { name: a.name, section: a.section, sortOrder: i },
    });
  }
}
