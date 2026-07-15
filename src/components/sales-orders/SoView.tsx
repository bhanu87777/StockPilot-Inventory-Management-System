"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SoBadge } from "@/components/Badges";
import { formatMoney, dateLabel } from "@/lib/utils";
import type { ProductRow } from "@/lib/inventory";
import type { CustomerRow, SoRow } from "@/lib/sales";
import type { WarehouseRow } from "@/lib/warehouses";

type DraftLine = { productId: string; quantity: string };

export function SoView({
  sos,
  products,
  customers,
  warehouses,
  canTransition = true,
}: {
  sos: SoRow[];
  products: ProductRow[];
  customers: CustomerRow[];
  warehouses: WarehouseRow[];
  canTransition?: boolean;
}) {
  const router = useRouter();
  // ?new=1 (command palette / shortcut) opens the create modal on mount; the
  // effect below only strips the param.
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(searchParams.get("new") === "1" && canTransition);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id ?? "");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      router.replace("/sales-orders", { scroll: false });
    }
  }, [searchParams, router]);

  const availableAt = (p: ProductRow) => p.levels.find((l) => l.warehouseId === warehouseId)?.quantity ?? 0;

  function openCreate() {
    setError(null);
    setLines([{ productId: "", quantity: "" }]);
    setCreating(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    const res = await fetch("/api/sales-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, warehouseId, items }),
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

  async function act(so: SoRow, action: "confirm" | "fulfill" | "cancel") {
    if (action === "cancel" && !confirm(`Cancel ${so.number}?`)) return;
    setActingOn(so.id);
    const res = await fetch(`/api/sales-orders/${so.id}`, {
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
          <h1 className="font-display text-3xl font-bold tracking-tight">Sales orders</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Draft → confirmed → fulfilled. Fulfillment writes OUT movements at the order&apos;s warehouse — all lines or none.
          </p>
        </div>
        {canTransition && (
          <button onClick={openCreate} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
            + New sales order
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {sos.map((so) => (
          <section key={so.id} className="panel panel-hover p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="num font-display text-lg font-bold">{so.number}</h3>
                <SoBadge status={so.status} />
              </div>
              {canTransition && (
                <div className="flex items-center gap-2">
                  {so.status === "DRAFT" && (
                    <>
                      <button onClick={() => act(so, "confirm")} disabled={actingOn === so.id} className="btn-accent rounded-lg px-4 py-1.5 text-xs disabled:opacity-60">
                        Confirm
                      </button>
                      <button onClick={() => act(so, "cancel")} disabled={actingOn === so.id} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-critical">
                        Cancel
                      </button>
                    </>
                  )}
                  {so.status === "CONFIRMED" && (
                    <>
                      <button onClick={() => act(so, "fulfill")} disabled={actingOn === so.id} className="btn-accent rounded-lg px-4 py-1.5 text-xs disabled:opacity-60">
                        {actingOn === so.id ? "Fulfilling…" : `Fulfill from ${so.warehouseCode}`}
                      </button>
                      <button onClick={() => act(so, "cancel")} disabled={actingOn === so.id} className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-critical">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="mb-3 text-xs text-muted">
              {so.customerName} · from {so.warehouseCode} · created {dateLabel(so.createdAt)}
              {so.confirmedAt && ` · confirmed ${dateLabel(so.confirmedAt)}`}
              {so.fulfilledAt && ` · fulfilled ${dateLabel(so.fulfilledAt)}`}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2 pr-4 font-semibold">SKU</th>
                    <th className="pb-2 pr-4 font-semibold">Product</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Unit price</th>
                    <th className="pb-2 text-right font-semibold">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {so.items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60 last:border-0">
                      <td className="num py-2 pr-4 text-xs text-muted">{i.sku}</td>
                      <td className="py-2 pr-4 font-semibold">{i.productName}</td>
                      <td className="num py-2 pr-4 text-right">{i.quantity}</td>
                      <td className="num py-2 pr-4 text-right">{formatMoney(i.unitPrice)}</td>
                      <td className="num py-2 text-right font-bold">{formatMoney(i.quantity * i.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="num mt-3 text-right text-sm font-bold">Total {formatMoney(so.totalRevenue)}</p>
          </section>
        ))}
        {sos.length === 0 && <div className="panel p-10 text-center text-sm text-muted">No sales orders yet.</div>}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setCreating(false)}>
          <form onSubmit={submit} className="panel w-full max-w-xl space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">New sales order</h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Customer</span>
                <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.country})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Fulfill from</span>
                <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({availableAt(p)} at warehouse)
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
              <button type="submit" disabled={busy || customers.length === 0} className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60">
                {busy ? "Creating…" : "Create draft SO"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
