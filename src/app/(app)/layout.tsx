import { signOut } from "@/auth";
import { hasPermission } from "@/lib/authz/scope";
import { requireUser } from "@/lib/session";
import { NavLink } from "./nav-link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <span className="font-display text-lg font-semibold">MSP งบกำไรขาดทุน</span>
          <nav className="flex gap-1 text-sm" aria-label="เมนูหลัก">
            <NavLink href="/">ภาพรวม</NavLink>
            {hasPermission(user, "data.upload") && <NavLink href="/upload">นำเข้าข้อมูล</NavLink>}
            {hasPermission(user, "users.manage") && <NavLink href="/users">ผู้ใช้และสิทธิ์</NavLink>}
          </nav>
          <form action={logout} className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-ink-2">{user.name}</span>
            <button type="submit" className="rounded-md px-2 py-1 text-ink-2 hover:bg-plane hover:text-ink">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
