"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateLabel } from "@/lib/utils";
import type { Role } from "@/lib/permissions";

type UserRow = { id: string; email: string; name: string | null; role: Role; createdAt: string };

const ROLES: Role[] = ["ADMIN", "PURCHASING", "VIEWER"];

export function UsersView({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeRole(u: UserRow, newRole: Role) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Role change failed.");
      return;
    }
    router.refresh();
  }

  async function remove(u: UserRow) {
    if (!confirm(`Delete ${u.email}? Their movements keep an anonymous history.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed.");
      return;
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setAdding(false);
    setName("");
    setEmail("");
    setPassword("");
    setRole("VIEWER");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Admin manages everything · Purchasing moves stock and runs orders · Viewer is read-only.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
          + Add user
        </button>
      </div>

      <p className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-xs text-ink-secondary">
        ℹ Role changes take effect at the user&apos;s <strong>next sign-in</strong> — the role rides in their session token.
      </p>

      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2.5 pr-4 font-semibold">User</th>
              <th className="pb-2.5 pr-4 font-semibold">Email</th>
              <th className="pb-2.5 pr-4 font-semibold">Joined</th>
              <th className="pb-2.5 pr-4 font-semibold">Role</th>
              <th className="pb-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="py-3 pr-4 font-semibold">
                  {u.name ?? "—"}
                  {u.id === selfId && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                </td>
                <td className="py-3 pr-4 text-ink-secondary">{u.email}</td>
                <td className="py-3 pr-4 text-xs text-muted">{dateLabel(u.createdAt)}</td>
                <td className="py-3 pr-4">
                  <select
                    className="input w-auto py-1.5 text-xs"
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 text-right">
                  {u.id !== selfId && (
                    <button onClick={() => remove(u)} className="btn-ghost rounded-md px-2.5 py-1 text-xs text-critical">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setAdding(false)}>
          <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Add user</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Purchasing" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Password (min 8 chars)</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Role</span>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setAdding(false)} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60">
                {busy ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
