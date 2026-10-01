"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 ${active ? "bg-plane font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
