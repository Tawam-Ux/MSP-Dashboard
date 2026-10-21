import { HttpError, type AuthProvider } from "react-admin";
import { DASHBOARD_URL } from "./config";

// ใช้ session ของ NextAuth จากเว็บหลัก: /api ถูก proxy มาที่โดเมนเดียวกัน cookie ล็อกอินจึงส่งไปด้วยอัตโนมัติ
// แอปนี้ไม่มีหน้า login เอง — ส่งไปหน้า login ของเว็บหลัก แล้วเว็บหลักส่งกลับมาตาม callbackUrl
// (เว็บหลักต้องตั้ง ADMIN_APP_URL ให้ตรงกับ origin ของแอปนี้ ไม่อย่างนั้นจะถูกส่งไปหน้า Dashboard แทน)

type Me = { id: number; fullName: string; username: string; permissions: string[] };

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/admin/me", { cache: "no-store" });
  if (!res.ok) throw new HttpError("กรุณาเข้าสู่ระบบ", res.status);
  return res.json();
}

function goToLogin() {
  window.location.assign(`${DASHBOARD_URL}/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
}

export const authProvider: AuthProvider = {
  login: async () => goToLogin(),
  logout: async () => {
    // ออกจากระบบผ่าน endpoint ของ Auth.js ต้องแนบ CSRF token
    try {
      const { csrfToken } = await fetch("/api/auth/csrf").then((r) => r.json());
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
        body: new URLSearchParams({ csrfToken }),
      });
    } finally {
      window.location.assign(`${DASHBOARD_URL}/login`);
    }
    return false;
  },
  checkAuth: async () => {
    let me: Me;
    try {
      me = await fetchMe();
    } catch {
      goToLogin();
      throw { redirectTo: false };
    }
    if (!me.permissions.includes("users.manage")) {
      window.location.assign(DASHBOARD_URL);
      throw { redirectTo: false };
    }
  },
  checkError: async (error: { status?: number }) => {
    if (error?.status === 401) {
      goToLogin();
      throw { redirectTo: false, logoutUser: false };
    }
    // 403 = ไม่มีสิทธิ์ทำรายการนั้น ให้แสดงข้อความ แต่ไม่ออกจากระบบ
  },
  getIdentity: async () => {
    const me = await fetchMe();
    return { id: me.id, fullName: me.fullName };
  },
  getPermissions: async () => (await fetchMe()).permissions,
};
