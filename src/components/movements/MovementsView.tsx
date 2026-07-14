"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MovementBadge } from "@/components/Badges";
import { dateTimeLabel } from "@/lib/utils";
import type { MovementRow, ProductRow } from "@/lib/inventory";

const TYPE_FILTERS = ["All", "IN", "OUT", "ADJUST"] as const;

export function MovementsView({ movements, products }: { movements: MovementRow[]; products: ProductRow[] }) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  // Record-movement form
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [type, setType] = useState<"IN" | "OUT" | "ADJUST">("OUT");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = products.find((p) => p.id === productId);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (typeFilter !== "All" && m.type !== typeFilter) return false;
      if (q && !`${m.sku} ${m.productName} ${m.reason} ${m.reference ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movements, typeFilter, query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type, quantity: Number(quantity), reason, reference }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const data = await res.json();
    setOk(`Recorded — ${data.product.sku} balance is now ${data.balance}.`);
    setQuantity("1");
    setReason("");
    setReference("");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Stock movements</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          The append-only ledger — every change to on-hand stock lives here with a reason.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Record form */}
        <form onSubmit={submit} className="panel h-fit space-y-4 p-6">
          <h3 className="text-sm font-bold">Record a movement</h3>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Product</span>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({p.quantity} on hand)
                </option>
              ))}
            </select>
          </label>

          <div className="flex rounded-lg border border-border bg-surface p-1">
            {(["IN", "OUT", "ADJUST"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  type === t ? "bg-[var(--accent-wash)] text-accent" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {t === "IN" ? "↓ In" : t === "OUT" ? "↑ Out" : "± Adjust"}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Quantity {type === "ADJUST" && "(signed — e.g. -3 for shrinkage)"}
            </span>
            <input
              className="input"
              type="number"
              value={quantity}
              min={type === "ADJUST" ? undefined : 1}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            {selected && type === "OUT" && (
              <span className="mt-1 block text-xs text-muted">{selected.quantity} available</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Reason</span>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === "IN" ? "PO received" : type === "OUT" ? "Online order" : "Cycle count correction"}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Reference (optional)</span>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SO-12345 / PO-2026-0405" />
          </label>

          {error && <p className="text-sm text-critical">{error}</p>}
          {ok && <p className="text-sm text-good">✓ {ok}</p>}

          <button type="submit" disabled={busy || products.length === 0} className="btn-accent w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
            {busy ? "Recording…" : "Record movement"}
          </button>
        </form>

        {/* Ledger */}
        <section className="panel p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input className="input max-w-xs" placeholder="Search SKU, product, reason…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex rounded-lg border border-border bg-surface p-1">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    typeFilter === t ? "bg-[var(--accent-wash)] text-accent" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="ml-auto text-xs text-muted">{rows.length} entries</p>
          </div>

          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2.5 pr-4 font-semibold">When</th>
                  <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                  <th className="pb-2.5 pr-4 font-semibold">Product</th>
                  <th className="pb-2.5 pr-4 font-semibold">Type</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Qty</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Balance</th>
                  <th className="pb-2.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-ink-secondary">{dateTimeLabel(m.occurredAt)}</td>
                    <td className="num py-2.5 pr-4 text-xs text-muted">{m.sku}</td>
                    <td className="py-2.5 pr-4 font-semibold">{m.productName}</td>
                    <td className="py-2.5 pr-4">
                      <MovementBadge type={m.type} />
                    </td>
                    <td className="num py-2.5 pr-4 text-right font-bold">
                      {m.type === "ADJUST" && m.quantity > 0 ? "+" : ""}
                      {m.type === "OUT" ? `−${m.quantity}` : m.quantity}
                    </td>
                    <td className="num py-2.5 pr-4 text-right text-ink-secondary">{m.balance}</td>
                    <td className="py-2.5 text-ink-secondary">
                      {m.reason}
                      {m.reference && <span className="text-muted"> · {m.reference}</span>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted">
                      Nothing matches this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
