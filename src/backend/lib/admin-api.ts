import "server-only";
import type { NextRequest } from "next/server";
import { db } from "@/backend/db";
import { hasPermission, type Permission } from "./authz/scope";
import { masterYears } from "./import-workbook";
import { getCurrentUser, type CurrentUser } from "./session";

// ตัวช่วยของ API /api/admin/* ที่หน้า react-admin (/admin) เรียกผ่าน ra-data-simple-rest
// รูปแบบ: GET ?sort=["field","ASC"]&range=[0,24]&filter={...} ตอบเป็น array + header Content-Range

export function apiError(status: number, message: string) {
  // ra-data-simple-rest แสดง body.message เป็นข้อความแจ้งเตือน
  return Response.json({ message }, { status });
}

/** แทน requirePermission ในฝั่ง API: ตอบ 401/403 แทนการ redirect */
export async function requireApiPermission(permission: Permission): Promise<CurrentUser | Response> {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "กรุณาเข้าสู่ระบบ");
  if (!hasPermission(user, permission)) return apiError(403, "ไม่มีสิทธิ์ใช้งานส่วนนี้");
  return user;
}

/**
 * ปีของข้อมูลหลักที่หน้าแอปหลังบ้านเลือก (?year= ปี ค.ศ. — แอปหลังบ้านแนบให้ทุกคำขอ)
 * ไม่ส่ง = ปีล่าสุดที่มีข้อมูลหลัก · ปีที่ยังไม่มีข้อมูลหลัก = 404 (ปีใหม่เกิดจากการนำเข้าไฟล์เท่านั้น ไม่สร้างจากการเปิดหน้า)
 */
export async function requestYear(req: Request): Promise<number | Response> {
  const years = await masterYears(db);
  const raw = new URL(req.url).searchParams.get("year");
  if (!raw) return years.at(-1) ?? new Date().getFullYear();
  const year = Number(raw);
  if (!years.includes(year)) return apiError(404, `ไม่มีฐานข้อมูลของปี ${Number.isInteger(year) ? year + 543 : raw}`);
  return year;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type Row = { id: string | number };

function matches(value: unknown, wanted: unknown): boolean {
  const list = Array.isArray(wanted) ? wanted.map(String) : [String(wanted)];
  if (Array.isArray(value)) return value.some((v) => list.includes(String(v)));
  return list.includes(String(value));
}

/**
 * กรอง/เรียง/แบ่งหน้าในหน่วยความจำ — เหมาะกับตารางหลังบ้านขนาดเล็ก (ผู้ใช้ บทบาท หน่วย)
 * filter.q ค้นหาแบบมีคำนี้อยู่ใน searchFields (filter.qField = จำกัดไว้ฟิลด์เดียวใน searchFields)
 * คีย์อื่นเทียบค่าตรงตัว (ส่ง array = ตรงกับค่าใดค่าหนึ่ง)
 */
export function listResponse<T extends Row>(req: NextRequest, resource: string, rows: T[], searchFields: (keyof T)[] = []) {
  const params = req.nextUrl.searchParams;
  const { qField, ...filter } = parseJson<Record<string, unknown>>(params.get("filter"), {});
  const [sortField, sortOrder] = parseJson<[string, string]>(params.get("sort"), ["id", "ASC"]);
  const fields = searchFields.filter((f) => !qField || f === qField);

  let result = rows.filter((row) =>
    Object.entries(filter).every(([key, wanted]) => {
      if (wanted === undefined || wanted === "") return true;
      if (key === "q") {
        const q = String(wanted).toLowerCase();
        return fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q));
      }
      return matches((row as Record<string, unknown>)[key], wanted);
    }),
  );

  const dir = sortOrder === "DESC" ? -1 : 1;
  result = [...result].sort((a, b) => {
    const x = (a as Record<string, unknown>)[sortField];
    const y = (b as Record<string, unknown>)[sortField];
    if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
    // numeric: เรียงตัวเลขในข้อความตามค่า (CM-99 ก่อน CM-100) ไม่ใช่ทีละตัวอักษร
    return String(x ?? "").localeCompare(String(y ?? ""), "th", { numeric: true }) * dir;
  });

  const total = result.length;
  const [start, end] = parseJson<[number, number]>(params.get("range"), [0, Math.max(total - 1, 0)]);
  const page = result.slice(start, end + 1);
  return Response.json(page, {
    headers: { "Content-Range": `${resource} ${start}-${start + Math.max(page.length - 1, 0)}/${total}` },
  });
}

/** อ่าน body JSON; ถ้าไม่ใช่ JSON คืน null */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
