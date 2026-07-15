"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney as money } from "@/lib/utils";
import { ExpiryBadge } from "@/components/Badges";
import type { ProductRow, LotRow } from "@/lib/inventory";
import type { WarehouseRow } from "@/lib/warehouses";

export function WarehousesView({
  warehouses,
  products,
  lots,
  canTransfer,
  canCreate,
}: {
  warehouses: WarehouseRow[];
  products: ProductRow[];
  lots: LotRow[];
  canTransfer: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [activeWh, setActiveWh] = useState(warehouses[0]?.id ?? "");
  const [query, setQuery] = useState("");

  // Transfer form
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [fromId, setFromId] = useState(warehouses[0]?.id ?? "");
  const [toId, setToId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [lotId, setLotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New-warehouse form
  const [creating, setCreating] = useState(false);
  const [nwCode, setNwCode] = useState("");
  const [nwName, setNwName] = useState("");
  const [nwCity, setNwCity] = useState("");
  const [nwError, setNwError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);
  const availableAtSource = selectedProduct?.levels.find((l) => l.warehouseId === fromId)?.quantity ?? 0;
  const transferLots = useMemo(
    () => lots.filter((l) => l.productId === productId && l.warehouseId === fromId),
    [lots, productId, fromId]
  );

  const stockRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .map((p) => ({ p, level: p.levels.find((l) => l.warehouseId === activeWh)?.quantity ?? 0 }))
      .filter(({ p, level }) => level > 0 && (!q || `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q)))
      .sort((a, b) => b.level * b.p.unitCost - a.level * a.p.unitCost);
  }, [products, activeWh, query]);

  const whLots = useMemo(() => lots.filter((l) => l.warehouseId === activeWh), [lots, activeWh]);

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        quantity: Number(qty),
        lotId: lotId || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const data = await res.json();
    setOk(`Transferred — ${data.reference}.`);
    setQty("1");
    setLotId("");
    router.refresh();
  }

  async function submitWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setNwError(null);
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: nwCode, name: nwName, city: nwCity }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNwError(data.error ?? "Something went wrong.");
      return;
    }
    setCreating(false);
    setNwCode("");
    setNwName("");
    setNwCity("");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Warehouses</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Per-site stock levels — transfers move units between sites without changing the total.
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setCreating(true)} className="btn-accent rounded-lg px-4 py-2 text-sm">
            + Add warehouse
          </button>
        )}
      </div>

      {/* Warehouse cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveWh(w.id)}
            className={`panel p-5 text-left transition-colors ${activeWh === w.id ? "ring-2 ring-[var(--accent-bright)]" : "hover:bg-surface-2"}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">{w.code}</p>
              {w.isDefault && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-ink-secondary">
              {w.name}
              {w.city ? ` · ${w.city}` : ""}
            </p>
            <div className="mt-3 flex gap-5 text-sm">
              <span>
                <span className="num font-bold">{w.skuCount}</span> <span className="text-muted">SKUs</span>
              </span>
              <span>
                <span className="num font-bold">{w.totalUnits.toLocaleString()}</span> <span className="text-muted">units</span>
              </span>
              <span>
                <span className="num font-bold">{money(w.stockValue)}</span> <span className="text-muted">value</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${canTransfer ? "xl:grid-cols-3" : ""}`}>
        {/* Transfer form */}
        {canTransfer && (
          <form onSubmit={submitTransfer} className="panel h-fit space-y-4 p-6">
            <h3 className="text-sm font-bold">Transfer stock</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Product</span>
              <select className="input" value={productId} onChange={(e) => { setProductId(e.target.value); setLotId(""); }}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">From</span>
                <select className="input" value={fromId} onChange={(e) => { setFromId(e.target.value); setLotId(""); }}>
                  {warehouses.map((w) => {
                    const avail = selectedProduct?.levels.find((l) => l.warehouseId === w.id)?.quantity ?? 0;
                    return (
                      <option key={w.id} value={w.id}>
                        {w.code} ({avail})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">To</span>
                <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Quantity</span>
              <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
              <span className="mt-1 block text-xs text-muted">{availableAtSource} available at source</span>
            </label>
            {transferLots.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Lot (optional)</span>
                <select className="input" value={lotId} onChange={(e) => setLotId(e.target.value)}>
                  <option value="">No specific lot</option>
                  {transferLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotCode} · expires in {l.daysToExpiry}d · {l.qtyRemaining} left
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && <p className="text-sm text-critical">{error}</p>}
            {ok && <p className="text-sm text-good">✓ {ok}</p>}
            <button
              type="submit"
              disabled={busy || fromId === toId}
              className="btn-accent w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {busy ? "Transferring…" : fromId === toId ? "Pick two different sites" : "Transfer"}
            </button>
          </form>
        )}

        {/* Per-warehouse stock + lots */}
        <div className={`space-y-4 ${canTransfer ? "xl:col-span-2" : ""}`}>
          <section className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-bold">
                Stock at {warehouses.find((w) => w.id === activeWh)?.code ?? "—"}
              </h3>
              <input
                className="input ml-auto max-w-xs"
                placeholder="Search SKU, product…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                    <th className="pb-2.5 pr-4 font-semibold">Product</th>
                    <th className="pb-2.5 pr-4 font-semibold">Category</th>
                    <th className="pb-2.5 pr-4 text-right font-semibold">On hand here</th>
                    <th className="pb-2.5 pr-4 text-right font-semibold">Total</th>
                    <th className="pb-2.5 text-right font-semibold">Value here</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map(({ p, level }) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="num py-2.5 pr-4 text-xs text-muted">{p.sku}</td>
                      <td className="py-2.5 pr-4 font-semibold">{p.name}</td>
                      <td className="py-2.5 pr-4 text-ink-secondary">{p.category}</td>
                      <td className="num py-2.5 pr-4 text-right font-bold">{level}</td>
                      <td className="num py-2.5 pr-4 text-right text-ink-secondary">{p.quantity}</td>
                      <td className="num py-2.5 text-right text-ink-secondary">{money(level * p.unitCost)}</td>
                    </tr>
                  ))}
                  {stockRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted">
                        No stock at this warehouse.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="mb-4 text-sm font-bold">Lots at {warehouses.find((w) => w.id === activeWh)?.code ?? "—"}</h3>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2.5 pr-4 font-semibold">Lot</th>
                    <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                    <th className="pb-2.5 pr-4 font-semibold">Product</th>
                    <th className="pb-2.5 pr-4 text-right font-semibold">Remaining</th>
                    <th className="pb-2.5 pr-4 font-semibold">Expiry</th>
                    <th className="pb-2.5 text-right font-semibold">At risk</th>
                  </tr>
                </thead>
                <tbody>
                  {whLots.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="num py-2.5 pr-4 text-xs">{l.lotCode}</td>
                      <td className="num py-2.5 pr-4 text-xs text-muted">{l.sku}</td>
                      <td className="py-2.5 pr-4 font-semibold">{l.productName}</td>
                      <td className="num py-2.5 pr-4 text-right">{l.qtyRemaining} / {l.qtyReceived}</td>
                      <td className="py-2.5 pr-4">
                        <ExpiryBadge daysToExpiry={l.daysToExpiry} />
                      </td>
                      <td className="num py-2.5 text-right text-ink-secondary">{money(l.qtyRemaining * l.unitCost)}</td>
                    </tr>
                  ))}
                  {whLots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted">
                        No active lots here — receive a perishable PO to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* New warehouse modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <form onSubmit={submitWarehouse} className="panel w-full max-w-md space-y-4 p-6">
            <h3 className="text-sm font-bold">Add warehouse</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Code</span>
              <input className="input" value={nwCode} onChange={(e) => setNwCode(e.target.value.toUpperCase())} placeholder="EAST" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Name</span>
              <input className="input" value={nwName} onChange={(e) => setNwName(e.target.value)} placeholder="East Fulfillment Hub" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">City (optional)</span>
              <input className="input" value={nwCity} onChange={(e) => setNwCity(e.target.value)} />
            </label>
            {nwError && <p className="text-sm text-critical">{nwError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-accent flex-1 rounded-lg px-4 py-2 text-sm">
                Create
              </button>
              <button type="button" onClick={() => setCreating(false)} className="btn-ghost flex-1 rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
