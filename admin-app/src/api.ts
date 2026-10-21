import { HttpError } from "react-admin";
import { withYear } from "./year";

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(withYear(`/api/admin${path}`), { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(data?.message ?? `โหลดข้อมูลไม่สำเร็จ (${res.status})`, res.status, data);
  return data as T;
}

// เรียก API ของเว็บหลักที่ไม่ใช่รูปแบบ ra-data-simple-rest (เช่นแก้หลายหน่วยในคำขอเดียว) — แนบปีที่เลือกเหมือน dataProvider
// /api ถูก proxy มาโดเมนเดียวกัน cookie ล็อกอินจึงส่งไปด้วยอัตโนมัติ
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(withYear(`/api/admin${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(data?.message ?? `บันทึกไม่สำเร็จ (${res.status})`, res.status, data);
  return data as T;
}
