"use client";

import { useMemo, useState } from "react";
import { dateTimeLabel } from "@/lib/utils";
import type { AuditRow } from "@/lib/audit";

export function AuditView({ logs }: { logs: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("All");
  const [user, setUser] = useState("All");

  const entities = useMemo(() => ["All", ...Array.from(new Set(logs.map((l) => l.entityType))).sort()], [logs]);
  const users = useMemo(() => ["All", ...Array.from(new Set(logs.map((l) => l.userEmail))).sort()], [logs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (entity !== "All" && l.entityType !== entity) return false;
      if (user !== "All" && l.userEmail !== user) return false;
      if (q && !`${l.action} ${l.summary} ${l.userEmail}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, query, entity, user]);

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Who did what, when — rows survive user deletion via email snapshots.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search action, summary…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input max-w-[200px]" value={entity} onChange={(e) => setEntity(e.target.value)}>
          {entities.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select className="input max-w-[260px]" value={user} onChange={(e) => setUser(e.target.value)}>
          {users.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <p className="ml-auto text-xs text-muted">{rows.length} entries</p>
      </div>

      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2.5 pr-4 font-semibold">When</th>
              <th className="pb-2.5 pr-4 font-semibold">User</th>
              <th className="pb-2.5 pr-4 font-semibold">Action</th>
              <th className="pb-2.5 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-ink-secondary">{dateTimeLabel(l.createdAt)}</td>
                <td className="py-2.5 pr-4 text-xs text-muted">{l.userEmail}</td>
                <td className="num py-2.5 pr-4">
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold">{l.action}</span>
                </td>
                <td className="py-2.5 text-ink-secondary">{l.summary}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted">
                  Nothing matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
