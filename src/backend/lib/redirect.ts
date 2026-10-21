// ปลายทางหลังล็อกอินมาจาก query string (?callbackUrl=) จึงต้องกรองก่อน กันการพาไปเว็บอื่น (open redirect)

/** origin ของแอปหลังบ้าน (react-admin) ที่อนุญาตให้ส่งกลับไปได้ เช่น http://localhost:5173 */
export function adminAppOrigin(env: string | undefined = process.env.ADMIN_APP_URL): string | null {
  if (!env) return null;
  try {
    return new URL(env).origin;
  } catch {
    return null;
  }
}

/** คืน path ภายในเว็บนี้ หรือ URL ของแอปหลังบ้าน; นอกนั้นคืน "/" */
export function safeCallbackUrl(raw: unknown, adminOrigin: string | null = adminAppOrigin()): string {
  if (typeof raw !== "string" || raw === "") return "/";
  // "//evil.com" และ "/\evil.com" เบราว์เซอร์ตีความเป็นโดเมนอื่น
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  if (!adminOrigin) return "/";
  try {
    return new URL(raw).origin === adminOrigin ? raw : "/";
  } catch {
    return "/";
  }
}
