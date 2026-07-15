"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MovementBadge } from "@/components/Badges";
import { ScanInput } from "@/components/scan/ScanInput";
import { CameraScanModal } from "@/components/scan/CameraScanModal";
import { dateTimeLabel } from "@/lib/utils";
import type { MovementRow, ProductRow, LotRow } from "@/lib/inventory";
import type { WarehouseRow } from "@/lib/warehouses";

const TYPE_FILTERS = ["All", "IN", "OUT", "ADJUST", "TRANSFER"] as const;

export function MovementsView({
  movements,
  products,
  warehouses,
  lots,
  canRecord = true,
}: {
  movements: MovementRow[];
  products: ProductRow[];
  warehouses: WarehouseRow[];
  lots: LotRow[];
  canRecord?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Record-movement form
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id ?? "");
  const [type, setType] = useState<"IN" | "OUT" | "ADJUST">("OUT");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [lotId, setLotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = products.find((p) => p.id === productId);
  const availableHere = selected?.levels.find((l) => l.warehouseId === warehouseId)?.quantity ?? 0;

  // Deep link from the command palette / shortcuts: ?focus=record.
  useEffect(() => {
    if (searchParams.get("focus") === "record") {
      formRef.current?.querySelector("select")?.focus();
      router.replace("/movements", { scroll: false });
    }
  }, [searchParams, router]);

  function onScanMatch(p: ProductRow) {
    setProductId(p.id);
    setLotId("");
    qtyRef.current?.focus();
    qtyRef.current?.select();
  }

  // FEFO: lots for the selected (product, warehouse), earliest expiry first
  // (getLots already sorts by expiry).
  const productLots = useMemo(
    () => lots.filter((l) => l.productId === productId && l.warehouseId === warehouseId),
    [lots, productId, warehouseId]
  );
  const showLotSelect = type === "OUT" && !!selected?.isPerishable && productLots.length > 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (typeFilter === "TRANSFER") {
        if (m.type !== "TRANSFER_IN" && m.type !== "TRANSFER_OUT") return false;
      } else if (typeFilter !== "All" && m.type !== typeFilter) {
        return false;
      }
      if (q && !`${m.sku} ${m.productName} ${m.reason} ${m.reference ?? ""} ${m.warehouseCode}`.toLowerCase().includes(q))
        return false;
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
      body: JSON.stringify({
        productId,
        warehouseId,
        type,
        quantity: Number(quantity),
        reason,
        reference,
        lotId: showLotSelect && lotId ? lotId : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const data = await res.json();
    setOk(`Recorded — ${data.product.sku} @ ${data.warehouse.code} balance is now ${data.balance}.`);
    setQuantity("1");
    setReason("");
    setReference("");
    setLotId("");
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

      <div className={`grid grid-cols-1 gap-4 ${canRecord ? "xl:grid-cols-3" : ""}`}>
        {/* Record form */}
        {canRecord && (
        <form ref={formRef} onSubmit={submit} className="panel h-fit space-y-4 p-6">
          <h3 className="text-sm font-bold">Record a movement</h3>

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <ScanInput products={products} onMatch={onScanMatch} />
            </div>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="btn-ghost shrink-0 rounded-lg px-3 py-2 text-sm"
              title="Scan with camera"
              aria-label="Scan with camera"
            >
              📷
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Product</span>
            <select className="input" value={productId} onChange={(e) => { setProductId(e.target.value); setLotId(""); }}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({p.quantity} on hand)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Warehouse</span>
            <select className="input" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLotId(""); }}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
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
              ref={qtyRef}
              className="input"
              type="number"
              value={quantity}
              min={type === "ADJUST" ? undefined : 1}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            {selected && type === "OUT" && (
              <span className="mt-1 block text-xs text-muted">
                {availableHere} available at {warehouses.find((w) => w.id === warehouseId)?.code ?? "—"}
                {selected.levels.length > 1 && ` · ${selected.quantity} total`}
              </span>
            )}
          </label>

          {showLotSelect && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                Lot (FEFO — earliest expiry first)
              </span>
              <select className="input" value={lotId || productLots[0].id} onChange={(e) => setLotId(e.target.value)}>
                {productLots.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    {i === 0 ? "★ FEFO — " : ""}
                    {l.lotCode} · {l.daysToExpiry < 0 ? "expired" : `expires in ${l.daysToExpiry}d`} · {l.qtyRemaining} left
                  </option>
                ))}
              </select>
            </label>
          )}

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
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SO-2026-0101 / PO-2026-0405" />
          </label>

          {error && <p className="text-sm text-critical">{error}</p>}
          {ok && <p className="text-sm text-good">✓ {ok}</p>}

          <button type="submit" disabled={busy || products.length === 0} className="btn-accent w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
            {busy ? "Recording…" : "Record movement"}
          </button>
        </form>
        )}

        {/* Ledger */}
        <section className={`panel p-5 ${canRecord ? "xl:col-span-2" : ""}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input data-shortcut-search className="input max-w-xs" placeholder="Search SKU, product, reason…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
            <a href="/api/reports/movements" className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              ⇓ Export CSV
            </a>
          </div>

          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2.5 pr-4 font-semibold">When</th>
                  <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                  <th className="pb-2.5 pr-4 font-semibold">Product</th>
                  <th className="pb-2.5 pr-4 font-semibold">WH</th>
                  <th className="pb-2.5 pr-4 font-semibold">Type</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Qty</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Balance</th>
                  <th className="pb-2.5 pr-4 font-semibold">Reason</th>
                  <th className="pb-2.5 font-semibold">By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-ink-secondary">{dateTimeLabel(m.occurredAt)}</td>
                    <td className="num py-2.5 pr-4 text-xs text-muted">{m.sku}</td>
                    <td className="py-2.5 pr-4 font-semibold">{m.productName}</td>
                    <td className="num py-2.5 pr-4 text-xs text-muted">{m.warehouseCode}</td>
                    <td className="py-2.5 pr-4">
                      <MovementBadge type={m.type} />
                    </td>
                    <td className="num py-2.5 pr-4 text-right font-bold">
                      {m.type === "ADJUST" && m.quantity > 0 ? "+" : ""}
                      {m.type === "OUT" || m.type === "TRANSFER_OUT" ? `−${m.quantity}` : m.quantity}
                    </td>
                    <td className="num py-2.5 pr-4 text-right text-ink-secondary">{m.balance}</td>
                    <td className="py-2.5 pr-4 text-ink-secondary">
                      {m.reason}
                      {m.reference && <span className="text-muted"> · {m.reference}</span>}
                      {m.lotCode && <span className="text-muted"> · {m.lotCode}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-xs text-muted">{m.createdByName ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-muted">
                      Nothing matches this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {cameraOpen && <CameraScanModal products={products} onMatch={onScanMatch} onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
