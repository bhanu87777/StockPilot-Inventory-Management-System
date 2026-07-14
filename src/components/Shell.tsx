"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/inventory", label: "Inventory", icon: "▤" },
  { href: "/movements", label: "Movements", icon: "⇅" },
  { href: "/purchase-orders", label: "Purchase orders", icon: "⎙" },
  { href: "/suppliers", label: "Suppliers", icon: "◫" },
  { href: "/advisor", label: "Reorder advisor", icon: "✦" },
];

export function Shell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">StockPilot</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
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
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate px-2 text-sm font-semibold">{user.name ?? "Operator"}</p>
          <p className="truncate px-2 text-xs text-muted">{user.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn-ghost mt-3 w-full rounded-lg px-3 py-2 text-xs"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="font-display font-bold">StockPilot</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
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
          <button onClick={() => signOut({ callbackUrl: "/" })} className="px-2 py-1.5 text-xs text-muted">
            Exit
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
