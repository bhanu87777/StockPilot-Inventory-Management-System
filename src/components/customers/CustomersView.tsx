"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import type { CustomerRow } from "@/lib/sales";

export function CustomersView({ customers, canCreate = true }: { customers: CustomerRow[]; canCreate?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, country }),
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
    setCountry("");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Who the stock ships to — lifetime revenue counts fulfilled orders only.
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setAdding(true)} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
            + Add customer
          </button>
        )}
      </div>

      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2.5 pr-4 font-semibold">Customer</th>
              <th className="pb-2.5 pr-4 font-semibold">Contact</th>
              <th className="pb-2.5 pr-4 font-semibold">Country</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">Orders</th>
              <th className="pb-2.5 text-right font-semibold">Lifetime revenue</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="py-3 pr-4 font-semibold">{c.name}</td>
                <td className="py-3 pr-4 text-ink-secondary">{c.email || "—"}</td>
                <td className="py-3 pr-4 text-ink-secondary">{c.country}</td>
                <td className="num py-3 pr-4 text-right">{c.orderCount}</td>
                <td className="num py-3 text-right font-bold">{formatMoney(c.lifetimeRevenue)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted">
                  No customers yet — add one to start selling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setAdding(false)}>
          <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Add customer</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Retail" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Email (optional)</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@northwind.example" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Country</span>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Singapore" required />
            </label>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setAdding(false)} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60">
                {busy ? "Adding…" : "Add customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
