"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dateTimeLabel } from "@/lib/utils";
import type { NotificationRow } from "@/lib/notifications";

const FILTERS = ["All", "LOW_STOCK", "STOCKOUT", "PO_RECEIVED", "PO_OVERDUE", "SO_FULFILLED", "LOT_EXPIRING"] as const;
const LABELS: Record<string, string> = {
  All: "All",
  LOW_STOCK: "Low stock",
  STOCKOUT: "Stockout",
  PO_RECEIVED: "PO received",
  PO_OVERDUE: "PO overdue",
  SO_FULFILLED: "SO fulfilled",
  LOT_EXPIRING: "Expiring",
};

export function NotificationsView({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(
    () => notifications.filter((n) => filter === "All" || n.type === filter),
    [notifications, filter]
  );
  const unread = notifications.filter((n) => !n.read).length;

  async function markAll() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    router.refresh();
  }

  async function markOne(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Low stock, stockouts, receipts, and expiries — resolved alerts fade out.
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-ghost rounded-lg px-4 py-2 text-sm">
            Mark all read ({unread})
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f ? "bg-[var(--accent-wash)] text-accent" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((n) => (
          <div
            key={n.id}
            className={`panel flex items-start gap-3 p-4 ${n.resolvedAt ? "opacity-55" : ""} ${!n.read ? "border-l-4 border-l-[var(--accent-bright)]" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {n.title}
                {n.resolvedAt && <span className="ml-2 text-xs font-normal text-muted">(resolved)</span>}
              </p>
              <p className="mt-0.5 text-sm text-ink-secondary">{n.body}</p>
              <p className="mt-1 text-xs text-muted">{dateTimeLabel(n.createdAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {n.href && (
                <Link href={n.href} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
                  View →
                </Link>
              )}
              {!n.read && (
                <button onClick={() => markOne(n.id)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="panel p-10 text-center text-sm text-muted">Nothing here. 🎉</div>}
      </div>
    </div>
  );
}
