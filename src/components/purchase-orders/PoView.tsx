"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PoBadge } from "@/components/Badges";
import { formatMoney, dateLabel, relativeDays } from "@/lib/utils";
import type { PoRow, ProductRow, SupplierRow } from "@/lib/inventory";

type DraftLine = { productId: string; quantity: string };

export function PoView({ pos, products, suppliers }: { pos: PoRow[]; products: ProductRow[]; suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const supplierProducts = products.filter((p) => p.supplierId === supplierId);

  function openCreate(prefillLow = false) {
    setError(null);
    if (prefillLow) {
      // Prefill with this supplier's low-stock SKUs at their default order size.
      const low = products.filter((p) => p.supplierId === supplierId && p.quantity <= p.reorderPoint);
      setLines(
        low.length > 0
          ? low.map((p) => ({ productId: p.id, quantity: String(p.reorderQty) }))
          : [{ productId: "", quantity: "" }]
      );
    } else {
      setLines([{ productId: "", quantity: "" }]);
    }
    setCreating(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId, items }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setCreating(false);
    router.refresh();
  }

  async function act(po: PoRow, action: "order" | "receive" | "cancel") {
    if (action === "cancel" && !confirm(`Cancel ${po.number}?`)) return;
    setActingOn(po.id);
    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActingOn(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Purchase orders</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Draft → ordered → received. Receiving writes IN movements and updates stock in one transaction.
          </p>
        </div>
        <button onClick={() => openCreate()} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
          + New purchase order
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {pos.map((po) => (
          <section key={po.id} className="panel panel-hover p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="num font-display text-lg font-bold">{po.number}</h3>
                <PoBadge status={po.status} />
              </div>
              <div className="flex items-center gap-2">
                {po.status === "DRAFT" && (
                  <>
                    <button onClick={() => act(po, "order")} disabled={actingOn === po.id} className="btn-accent rounded-lg px-4 py-1.5 text-xs disabled:opacity-60">
                      Mark ordered
                    </button>
                    <button onClick={() => act(po, "cancel")} disabled={actingOn === po.id} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-critical">
                      Cancel
                    </button>
                  </>
                )}
                {po.status === "ORDERED" && (
                  <>
                    <button onClick={() => act(po, "receive")} disabled={actingOn === po.id} className="btn-accent rounded-lg px-4 py-1.5 text-xs disabled:opacity-60">
                      {actingOn === po.id ? "Receiving…" : "Receive into stock"}
                    </button>
                    <button onClick={() => act(po, "cancel")} disabled={actingOn === po.id} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-critical">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mb-3 text-xs text-muted">
              {po.supplierName} · created {dateLabel(po.createdAt)}
              {po.orderedAt && ` · ordered ${dateLabel(po.orderedAt)}`}
              {po.expectedAt && po.status === "ORDERED" && ` · expected ${relativeDays(po.expectedAt)}`}
              {po.receivedAt && ` · received ${dateLabel(po.receivedAt)}`}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2 pr-4 font-semibold">SKU</th>
                    <th className="pb-2 pr-4 font-semibold">Product</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Unit cost</th>
                    <th className="pb-2 text-right font-semibold">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60 last:border-0">
                      <td className="num py-2 pr-4 text-xs text-muted">{i.sku}</td>
                      <td className="py-2 pr-4 font-semibold">{i.productName}</td>
                      <td className="num py-2 pr-4 text-right">{i.quantity}</td>
                      <td className="num py-2 pr-4 text-right">{formatMoney(i.unitCost)}</td>
                      <td className="num py-2 text-right font-bold">{formatMoney(i.quantity * i.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="num mt-3 text-right text-sm font-bold">Total {formatMoney(po.totalCost)}</p>
          </section>
        ))}
        {pos.length === 0 && (
          <div className="panel p-10 text-center text-sm text-muted">No purchase orders yet.</div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-4" onClick={() => setCreating(false)}>
          <form onSubmit={submit} className="panel w-full max-w-xl space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">New purchase order</h2>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Supplier</span>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setLines([{ productId: "", quantity: "" }]);
                }}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.leadTimeDays}d lead time
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={() => openCreate(true)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              Prefill this supplier&apos;s low-stock SKUs
            </button>

            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Line items</span>
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={line.productId}
                    onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, productId: e.target.value } : l)))}
                  >
                    <option value="">Select product…</option>
                    {supplierProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({p.quantity} on hand)
                      </option>
                    ))}
                  </select>
                  <input
                    className="input w-24"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                  />
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                    className="btn-ghost rounded-lg px-3 text-xs text-critical"
                    disabled={lines.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setLines([...lines, { productId: "", quantity: "" }])} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
                + Add line
              </button>
            </div>

            {error && <p className="text-sm text-critical">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60">
                {busy ? "Creating…" : "Create draft PO"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
