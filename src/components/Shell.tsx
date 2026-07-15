"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "./Logo";
import { NotificationBell } from "./notifications/NotificationBell";
import { useTheme } from "./ThemeProvider";
import { NAV } from "@/lib/nav";
import { can, type Role } from "@/lib/permissions";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PURCHASING: "Purchasing",
  VIEWER: "Viewer",
};

export function Shell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role?: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const nav = NAV.filter((item) => !item.action || can(user.role, item.action));

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">StockPilot</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent-wash)] font-semibold text-accent"
                    : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="w-4 text-center" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border pt-3">
          <div className="mb-2">
            <NotificationBell />
          </div>
          <div className="flex items-center gap-2 px-2">
            <p className="truncate text-sm font-semibold">{user.name ?? "Operator"}</p>
            {user.role && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {ROLE_LABEL[user.role]}
              </span>
            )}
          </div>
          <p className="truncate px-2 text-xs text-muted">{user.email}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={toggle}
              className="btn-ghost rounded-lg px-3 py-2 text-xs"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="btn-ghost flex-1 rounded-lg px-3 py-2 text-xs"
            >
              Sign out
            </button>
          </div>
          <p className="mt-2 px-2 text-[10px] text-muted">
            Press <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">K</kbd> to search · <kbd className="kbd">?</kbd> for shortcuts
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="font-display font-bold">StockPilot</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs ${
                pathname.startsWith(item.href) ? "bg-[var(--accent-wash)] font-semibold text-accent" : "text-ink-secondary"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button onClick={toggle} className="px-2 py-1.5 text-xs text-muted" aria-label="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="px-2 py-1.5 text-xs text-muted">
            Exit
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
