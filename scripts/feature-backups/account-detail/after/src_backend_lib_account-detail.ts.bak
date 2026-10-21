import "server-only";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import path from "node:path";
import { Readable } from "node:stream";
import { db } from "@/backend/db";
import { uploadLogs } from "@/backend/db/schema";
import { thaiMonth } from "./master-import/parse";
import type { CurrentUser } from "./session";

// ===== ฟีเจอร์ "รายละเอียดรายการในงบ" (ป๊อปอัปเมื่อกดชื่อรายการในการ์ดงบกำไรขาดทุนของรายละเอียดสาขา) =====
// ปิดชั่วคราว: ตั้ง ACCOUNT_DETAIL_ENABLED = false · ถอดออกทั้งหมด: node scripts/account-detail-feature.mjs remove
export const ACCOUNT_DETAIL_ENABLED = true;

// อ่านจากชีต "MASTER_<เดือน>" ของไฟล์ Master ที่ใช้อยู่ (ไม่เก็บลงฐานข้อมูล — ไม่ต้องแก้ตาราง ไม่ต้องนำเข้าใหม่)
// แถว 1 = หัวคอลัมน์: Group · โซน · สาขา · หมวด · รหัสบัญชี · ชื่อบัญชี · ยอดงวดปัจจุบัน …
// ลำดับคอลัมน์ไม่คงที่ทุกเดือน (เช่น ม.ค. "convert to number" มาก่อน "ยอดงวดปัจจุบัน" แต่ ส.ค. สลับกัน) จึงหาคอลัมน์จากชื่อหัว
// ใช้ "ยอดงวดปัจจุบัน" — ผลรวมตาม Group + สาขาตรงกับยอดที่นำเข้าในงบ

const SHEET_PREFIX = "MASTER_";

export type DetailRow = { account: string; name: string; amount: number };
export type AccountDetail = {
  rows: DetailRow[];
  total: number;
  /** ชีตที่อ่าน (เฉพาะเดือนที่เลือกและมีชีตในไฟล์) */
  sheets: string[];
  /** เดือนที่เลือกแต่ไม่มีชีต MASTER_ ของเดือนนั้นในไฟล์ */
  missing: string[];
  fileName: string;
};

export class AccountDetailError extends Error {}

/** month → "Group|สาขา" → แถว (รวมแถวรหัสบัญชีเดียวกันไว้ด้วยกัน) */
type Index = Map<number, Map<string, DetailRow[]>>;

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("error" in v) return null;
  }
  return v;
}
const cellText = (v: ExcelJS.CellValue) => String(cellValue(v) ?? "").trim();
function cellNumber(v: ExcelJS.CellValue): number {
  const x = cellValue(v);
  if (typeof x === "number") return x;
  const n = Number(String(x ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * ตัดก้อนข้อมูลให้จบที่ขอบตัวอักษร UTF-8 เสมอ (ไบต์ที่ค้างครึ่งตัวยกไปต่อก้อนถัดไป)
 * exceljs 4.4.0 แบบ stream แปลงไบต์เป็นข้อความทีละก้อน (utils/parse-sax.js: bufferToString(chunk)) —
 * ตัวอักษรไทย 3 ไบต์ที่ถูกตัดกลางตัวกลายเป็น "�" (ไฟล์ตัวอย่างเสีย 163 ข้อความ เช่น "วัสดุสิ้นเปลืองใ���ไป")
 */
async function* utf8Chunks(source: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
  let rest: Buffer = Buffer.alloc(0);
  for await (const chunk of source) {
    const buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    let cut = buf.length;
    // ไล่จากท้ายหาไบต์นำของตัวอักษรสุดท้าย (ไบต์ต่อเนื่องคือ 10xxxxxx) — ไม่ครบตามความยาวที่ไบต์นำบอก = ตัดก่อนตัวนั้น
    for (let i = buf.length - 1; i >= Math.max(0, buf.length - 4); i--) {
      const b = buf[i];
      if ((b & 0xc0) === 0x80) continue;
      const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
      if (i + need > buf.length) cut = i;
      break;
    }
    rest = buf.subarray(cut);
    if (cut > 0) yield buf.subarray(0, cut);
  }
  if (rest.length) yield rest;
}

/** เมธอดภายในของ WorkbookReader (ไม่มีใน type) ที่รับก้อนข้อมูลของ sharedStrings.xml และชีต */
type ReaderInternals = {
  _parseSharedStrings: (entry: AsyncIterable<Buffer>) => AsyncGenerator<unknown>;
  _parseWorksheet: (iterator: AsyncIterable<Buffer>, sheetNo: string) => Generator<unknown>;
};

/** อ่านเฉพาะชีต MASTER_ แบบ stream (ไฟล์ทั้งเล่มใหญ่ ชีตอื่นข้ามไป) — ~3 วินาทีต่อไฟล์ จึงแคชไว้ต่อไฟล์ */
async function buildIndex(file: string): Promise<Index> {
  const index: Index = new Map();
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    worksheets: "emit", sharedStrings: "cache", hyperlinks: "ignore", styles: "ignore", entries: "emit",
  });
  // ส่งก้อนข้อมูลที่ตัดตรงขอบตัวอักษรแล้วให้ exceljs (ดู utf8Chunks) — ทั้งตารางข้อความรวมและข้อความในชีต
  const internals = reader as unknown as ReaderInternals;
  const parseSharedStrings = internals._parseSharedStrings.bind(reader);
  const parseWorksheet = internals._parseWorksheet.bind(reader);
  internals._parseSharedStrings = (entry) => parseSharedStrings(Readable.from(utf8Chunks(entry)));
  internals._parseWorksheet = (iterator, sheetNo) => parseWorksheet(utf8Chunks(iterator), sheetNo);
  for await (const ws of reader) {
    // ExcelJS.stream ไม่มี type ของ name บน WorksheetReader
    const name = String((ws as unknown as { name?: string }).name ?? "");
    if (!name.startsWith(SHEET_PREFIX)) continue;
    const month = thaiMonthIndex(name.slice(SHEET_PREFIX.length));
    if (!month) continue;
    const byKey = new Map<string, DetailRow[]>();
    let col: { group: number; branch: number; account: number; name: number; amount: number } | null = null;
    for await (const row of ws) {
      const values = row.values as ExcelJS.CellValue[];
      if (!col) {
        const head = values.map((v) => squash(cellText(v)));
        const find = (test: (h: string) => boolean) => head.findIndex((h) => !!h && test(h));
        col = {
          group: find((h) => h === "group"),
          branch: find((h) => h === "สาขา"),
          account: find((h) => h === "รหัสบัญชี"),
          name: find((h) => h === "ชื่อบัญชี"),
          amount: find((h) => h.startsWith("ยอดงวดปัจจุบัน")),
        };
        if (Object.values(col).some((i) => i < 0)) {
          throw new AccountDetailError(`ชีต "${name}": ไม่พบหัวคอลัมน์ Group / สาขา / รหัสบัญชี / ชื่อบัญชี / ยอดงวดปัจจุบัน ในแถว 1`);
        }
        continue;
      }
      const group = cellText(values[col.group]);
      const branch = cellText(values[col.branch]);
      if (!group || !branch) continue;
      const key = `${group}|${branch}`;
      const list = byKey.get(key) ?? [];
      list.push({ account: cellText(values[col.account]), name: cellText(values[col.name]), amount: cellNumber(values[col.amount]) });
      byKey.set(key, list);
    }
    index.set(month, byKey);
  }
  return index;
}

const thaiMonthIndex = (s: string) => {
  for (let m = 1; m <= 12; m++) if (thaiMonth(m) === s.trim()) return m;
  return 0;
};

// แคชต่อไฟล์ (ชื่อไฟล์ที่เก็บไม่ซ้ำกัน — นำเข้าไฟล์ใหม่ = คีย์ใหม่) · ไฟล์ที่ใช้อยู่มีปีละไฟล์ จึงแคชได้หลายไฟล์
const cache = new Map<string, Promise<Index>>();

// ที่เดียวกับ master-storage.ts (ทำซ้ำไว้ในไฟล์นี้ ให้ถอดฟีเจอร์ออกได้โดยไม่แตะไฟล์อื่น) — stream ต้องใช้ path ไม่ใช่ Buffer
const storageDir = () => process.env.MASTER_STORAGE_DIR || path.join(process.cwd(), "storage", "masters");

/**
 * รายการบัญชีใน MASTER_ ของ Group และสาขาที่เลือก (บวกทุกเดือนที่เลือก)
 * periods = งวดของ Dashboard ("2026-08-01") — ต้องเป็นงวดของไฟล์ที่ใช้อยู่
 */
export async function getAccountDetail(user: CurrentUser, unitCode: string, group: string, periods: string[]): Promise<AccountDetail> {
  if (!user.allowedUnits.has(unitCode)) throw new AccountDetailError(`ไม่มีสิทธิ์ดูหน่วย ${unitCode}`);
  // ไฟล์ที่ใช้อยู่ปีละไฟล์ — งวดที่เลือกอาจข้ามปี จึงหาไฟล์ของแต่ละงวด
  const active = await db
    .select({ fileName: uploadLogs.fileName, storedPath: uploadLogs.storedPath, periods: uploadLogs.periods })
    .from(uploadLogs)
    .where(eq(uploadLogs.status, "active"));
  const fileOf = (p: string) => active.find((a) => (a.periods ?? "").split(",").includes(p));
  const wanted = [...periods].sort().flatMap((p) => {
    const file = fileOf(p);
    return file ? [{ period: p, file }] : [];
  });
  if (wanted.length === 0) throw new AccountDetailError("งวดที่เลือกไม่อยู่ในไฟล์ Master ที่ใช้อยู่");
  if (wanted.some((w) => !w.file.storedPath)) throw new AccountDetailError("ไม่พบไฟล์ Master ที่ใช้อยู่ในเครื่อง");
  const multiYear = new Set(wanted.map((w) => w.period.slice(0, 4))).size > 1;

  const indexOf = (storedPath: string) => {
    let index = cache.get(storedPath);
    if (!index) {
      const created = buildIndex(path.join(storageDir(), path.basename(storedPath)));
      cache.set(storedPath, created);
      // อ่านไม่สำเร็จ → ล้างแคช ให้ครั้งถัดไปลองใหม่
      created.catch(() => {
        if (cache.get(storedPath) === created) cache.delete(storedPath);
      });
      index = created;
    }
    return index;
  };
  // ไฟล์ที่ไม่ได้ใช้อยู่แล้ว (ถูกแทน) ไม่ต้องแคชต่อ
  const inUse = new Set(active.flatMap((a) => (a.storedPath ? [a.storedPath] : [])));
  for (const key of cache.keys()) if (!inUse.has(key)) cache.delete(key);

  const merged = new Map<string, DetailRow>();
  const sheets: string[] = [];
  const missing: string[] = [];
  for (const { period: p, file } of wanted) {
    const index = await indexOf(file.storedPath!);
    const month = Number(p.slice(5, 7));
    const sheet = `${SHEET_PREFIX}${thaiMonth(month)}${multiYear ? ` ${Number(p.slice(0, 4)) + 543}` : ""}`;
    const byKey = index.get(month);
    if (!byKey) {
      missing.push(sheet);
      continue;
    }
    sheets.push(sheet);
    for (const r of byKey.get(`${group}|${unitCode}`) ?? []) {
      const k = `${r.account}|${r.name}`;
      const cur = merged.get(k);
      merged.set(k, { ...r, amount: (cur?.amount ?? 0) + r.amount });
    }
  }
  const rows = [...merged.values()].filter((r) => Math.abs(r.amount) >= 0.005);
  const fileName = [...new Set(wanted.map((w) => w.file.fileName))].join(", ");
  return { rows, total: rows.reduce((t, r) => t + r.amount, 0), sheets, missing, fileName };
}
