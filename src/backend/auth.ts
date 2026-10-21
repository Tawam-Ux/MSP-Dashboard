import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { safeCallbackUrl } from "@/backend/lib/redirect";

const credentialsSchema = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

// ต้องล็อกอินใหม่ทุกครั้งที่ปิดเบราว์เซอร์หรือเริ่มเซิร์ฟเวอร์ใหม่:
// cookie ของ Auth.js มีวันหมดอายุเสมอ (อยู่ข้ามการปิดเบราว์เซอร์) จึงคู่กับ ALIVE_COOKIE ที่ไม่มีวันหมดอายุ
// (เบราว์เซอร์ลบเองเมื่อปิด) และเก็บรหัสรอบการทำงานของเซิร์ฟเวอร์ — ไม่มี cookie หรือรหัสไม่ตรง = ไม่ได้ล็อกอิน
// MSP_BOOT_ID ตั้งโดย scripts/dev-open.mjs ให้คงเดิมเมื่อ next dev รีสตาร์ต worker เอง · ไม่ตั้ง = สุ่มใหม่ทุก process
const g = globalThis as { mspBootId?: string };
export const BOOT_ID = (g.mspBootId ??= process.env.MSP_BOOT_ID || randomUUID());
export const ALIVE_COOKIE = "msp.alive";

// ตอนนี้ใช้ล็อกอินด้วยรหัสผ่าน; เมื่อเชื่อมเว็บหลัก ให้เพิ่ม provider (เช่น OIDC) ที่นี่
// แล้วจับคู่ผู้ใช้ด้วย users.auth_provider + users.external_id
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    // user มีค่าเฉพาะตอนล็อกอิน (login action ตั้ง ALIVE_COOKIE ไว้แล้ว) · null = ล้าง session ของ Auth.js
    async jwt({ token, user }) {
      if (user) return token;
      return (await cookies()).get(ALIVE_COOKIE)?.value === BOOT_ID ? token : null;
    },
    // ค่าเริ่มต้นของ Auth.js ไม่ใส่ id ลงใน session; getCurrentUser ต้องใช้ id ไปโหลดสิทธิ์
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    // ค่าเริ่มต้นส่งกลับได้เฉพาะเว็บนี้; เพิ่มให้ส่งกลับไปแอปหลังบ้าน (ADMIN_APP_URL) ได้หลังล็อกอิน/ออกจากระบบ
    redirect({ url, baseUrl }) {
      const safe = safeCallbackUrl(url.startsWith(baseUrl) ? url.slice(baseUrl.length) || "/" : url);
      return safe.startsWith("/") ? `${baseUrl}${safe}` : safe;
    },
  },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.username, parsed.data.username), eq(users.authProvider, "local"), eq(users.isActive, true)));
        if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: String(user.id), name: user.name };
      },
    }),
  ],
});
