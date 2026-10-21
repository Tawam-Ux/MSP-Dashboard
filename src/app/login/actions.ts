"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { ALIVE_COOKIE, BOOT_ID, signIn } from "@/backend/auth";
import { safeCallbackUrl } from "@/backend/lib/redirect";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  // ไม่ใส่ maxAge/expires = cookie หายเมื่อปิดเบราว์เซอร์ (ดู ALIVE_COOKIE ใน auth.ts) · ล็อกอินไม่สำเร็จก็ไม่มีผล เพราะยังไม่มี session
  (await cookies()).set(ALIVE_COOKIE, BOOT_ID, { httpOnly: true, sameSite: "lax", path: "/" });
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      // ตรวจซ้ำที่นี่ด้วย เพราะค่าใน hidden field แก้จากฝั่ง browser ได้
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
    return {};
  } catch (e) {
    // คืนชื่อผู้ใช้กลับไป ฟอร์มจะได้ไม่ล้างช่องที่กรอกแล้ว
    if (e instanceof AuthError) return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน", username };
    throw e; // redirect หลังล็อกอินสำเร็จทำงานผ่าน error นี้
  }
}
