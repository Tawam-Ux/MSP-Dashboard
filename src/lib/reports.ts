import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { facts, unitClosure, units } from "@/db/schema";
import { computeStatement, type Statement } from "./statement";
import type { CurrentUser } from "./session";

// ทุกฟังก์ชันในไฟล์นี้รับ user และกรองด้วย user.allowedUnits — ห้าม query ตาราง facts จากที่อื่น

export class ForbiddenUnitError extends Error {}

function assertCanSee(user: CurrentUser, unitCode: string) {
  if (!user.allowedUnits.has(unitCode)) throw new ForbiddenUnitError(`ไม่มีสิทธิ์ดูหน่วย ${unitCode}`);
}

const allowedList = (user: CurrentUser) => [...user.allowedUnits];

export async function listPeriods(user: CurrentUser): Promise<string[]> {
  if (user.allowedUnits.size === 0) return [];
  const rows = await db
    .selectDistinct({ period: facts.period })
    .from(facts)
    .where(inArray(facts.unitCode, allowedList(user)))
    .orderBy(desc(facts.period));
  return rows.map((r) => r.period);
}

export type UnitInfo = { code: string; name: string; level: number; parentCode: string | null };

/** หน่วยที่เลือก + เส้นทางจากหน่วยบนสุดที่ผู้ใช้เห็นได้ (สำหรับ breadcrumb) */
export async function getUnitPath(user: CurrentUser, unitCode: string): Promise<UnitInfo[]> {
  assertCanSee(user, unitCode);
  const ancestors = user.closure.filter((r) => r.descendant === unitCode && user.allowedUnits.has(r.ancestor));
  const rows = await db
    .select({ code: units.code, name: units.name, level: units.level, parentCode: units.parentCode })
    .from(units)
    .where(inArray(units.code, ancestors.map((a) => a.ancestor)))
    .orderBy(asc(units.level));
  return rows;
}

async function amountsByUnit(period: string, ancestorCodes: string[], allowed: string[]) {
  if (ancestorCodes.length === 0) return new Map<string, Record<string, number>>();
  const rows = await db
    .select({ unit: unitClosure.ancestor, account: facts.accountCode, amount: sql<string>`sum(${facts.amount})` })
    .from(facts)
    .innerJoin(unitClosure, eq(unitClosure.descendant, facts.unitCode))
    .where(and(eq(facts.period, period), inArray(unitClosure.ancestor, ancestorCodes), inArray(facts.unitCode, allowed)))
    .groupBy(unitClosure.ancestor, facts.accountCode);

  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const bucket = out.get(r.unit) ?? {};
    bucket[r.account] = Number(r.amount);
    out.set(r.unit, bucket);
  }
  return out;
}

export async function getStatement(user: CurrentUser, period: string, unitCode: string): Promise<Statement> {
  assertCanSee(user, unitCode);
  const amounts = await amountsByUnit(period, [unitCode], allowedList(user));
  return computeStatement(amounts.get(unitCode) ?? {});
}

export type ChildSummary = UnitInfo & { hasChildren: boolean; statement: Statement };

/** งบของหน่วยลูกแต่ละหน่วย (ที่ผู้ใช้เห็นได้) ใต้หน่วยที่เลือก */
export async function getChildren(user: CurrentUser, period: string, unitCode: string): Promise<ChildSummary[]> {
  assertCanSee(user, unitCode);
  const children = (
    await db
      .select({ code: units.code, name: units.name, level: units.level, parentCode: units.parentCode })
      .from(units)
      .where(eq(units.parentCode, unitCode))
      .orderBy(asc(units.sortOrder))
  ).filter((c) => user.allowedUnits.has(c.code));

  const amounts = await amountsByUnit(period, children.map((c) => c.code), allowedList(user));
  const parents = new Set(user.closure.filter((r) => r.depth === 1).map((r) => r.ancestor));
  return children.map((c) => ({
    ...c,
    hasChildren: parents.has(c.code),
    statement: computeStatement(amounts.get(c.code) ?? {}),
  }));
}
