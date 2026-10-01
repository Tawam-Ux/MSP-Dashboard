import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const credentialsSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

// ตอนนี้ใช้ล็อกอินด้วยรหัสผ่าน; เมื่อเชื่อมเว็บหลัก ให้เพิ่ม provider (เช่น OIDC) ที่นี่
// แล้วจับคู่ผู้ใช้ด้วย users.auth_provider + users.external_id
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
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
