import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-3xl font-semibold">MSP งบกำไรขาดทุน</h1>
      <p className="mt-1 mb-8 text-ink-2">เข้าสู่ระบบเพื่อดูผลประกอบการรายเดือน</p>
      <LoginForm />
    </main>
  );
}
