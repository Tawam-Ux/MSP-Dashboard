import { cookies } from "next/headers";
import { signOut } from "@/backend/auth";
import { BrandMark } from "@/frontend/components/brand-mark";
import { MoneyProvider } from "@/frontend/components/money";
import { NavPendingProvider } from "@/frontend/components/nav-pending";
import { ScrollContain } from "@/frontend/components/scroll-contain";
import { TabPane } from "@/frontend/components/tab-pane";
import { MONEY_COOKIE, parseMoneyMode } from "@/backend/lib/format";
import { hasPermission } from "@/backend/lib/authz/scope";
import { requireUser } from "@/backend/lib/session";
import { NavTabs } from "./nav-link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const jar = await cookies();
  const moneyMode = parseMoneyMode(jar.get(MONEY_COOKIE)?.value);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const canView = hasPermission(user, "dashboard.view");
  const adminUrl = process.env.ADMIN_APP_URL;
  const links = [
    { href: "/", label: "Overview", show: true },
    { href: "/pnl", label: "P&L Analysis", show: canView },
    { href: "/zones", label: "Sales Zone", show: canView },
    { href: "/operations", label: "Operations", show: canView },
    { href: "/upload", label: "Upload Data", show: hasPermission(user, "data.upload") },
    // จัดการผู้ใช้อยู่ในแอปหลังบ้าน (admin-app/) แสดงเมนูเมื่อตั้ง ADMIN_APP_URL
    { href: adminUrl ?? "", label: "Admin", show: !!adminUrl && hasPermission(user, "users.manage") },
  ].filter((l) => l.show);
  const initial = (user.name || user.username).trim().charAt(0).toUpperCase();

  // กดเมนูแล้วขึ้น skeleton ของหน้าปลายทางทันที: เมนูกับพื้นที่เนื้อหาใช้สถานะ "กำลังไป" ร่วมกัน (components/nav-pending.tsx)
  return (
    <NavPendingProvider>
      <div className="app-shell min-h-screen">
        <ScrollContain />
        <header className="topbar">
          <div className="topbar-in">
            <span className="brandmark">
              <BrandMark size={44} />
            </span>

            <NavTabs links={links.map(({ href, label }) => ({ href, label }))} />

            <form action={logout} className="topbar-user">
              <span className="user-chip" title={`${user.name} (${user.username})`}>
                <span className="avatar" aria-hidden="true">{initial}</span>
                <span className="hidden min-w-0 leading-tight sm:block">
                  <span className="block truncate text-[0.8125rem] font-medium text-ink">{user.name}</span>
                  <span className="block truncate text-xs text-ink-3">{user.username}</span>
                </span>
              </span>
              <button type="submit" className="icon-btn icon-btn-danger" aria-label="ออกจากระบบ" title="ออกจากระบบ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
                </svg>
              </button>
            </form>
          </div>
        </header>

        <main className="app-main mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-7 lg:py-7">
          <MoneyProvider initial={moneyMode}>
            <TabPane>{children}</TabPane>
          </MoneyProvider>
        </main>
      </div>
    </NavPendingProvider>
  );
}
