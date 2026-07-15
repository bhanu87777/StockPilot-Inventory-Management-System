"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { relativeDays } from "@/lib/utils";
import type { NotificationRow } from "@/lib/notifications";

const TYPE_ICON: Record<string, string> = {
  LOW_STOCK: "⚠",
  STOCKOUT: "⨯",
  PO_RECEIVED: "✓",
  PO_OVERDUE: "⏰",
  SO_FULFILLED: "⇈",
  LOT_EXPIRING: "⏳",
};

// Polls every 60s (plus a refetch on open) — no data-fetching library, in
// keeping with the app's zero-dependency ethos.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // transient network failure — next poll retries
    }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const t0 = setTimeout(load, 0);
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => {
      clearTimeout(t0);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, load]);

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost relative w-full rounded-lg px-3 py-2 text-left text-xs"
        aria-label={`Notifications — ${unread} unread`}
      >
        <span aria-hidden>🔔</span> Notifications
        {unread > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.slice(0, 8).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "/notifications"}
                onClick={() => setOpen(false)}
                className={`block border-b border-border/60 px-4 py-2.5 text-sm last:border-0 hover:bg-surface-2 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <p className="flex items-start gap-2 font-semibold">
                  <span aria-hidden>{TYPE_ICON[n.type] ?? "•"}</span>
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-bright)]" aria-label="unread" />}
                </p>
                <p className="mt-0.5 truncate pl-6 text-xs text-muted">
                  {n.body} · {relativeDays(n.createdAt)}
                </p>
              </Link>
            ))}
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">All quiet. 🎉</p>}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-accent hover:bg-surface-2"
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}
