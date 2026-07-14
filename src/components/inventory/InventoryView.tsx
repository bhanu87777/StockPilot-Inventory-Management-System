"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockBadge } from "@/components/Badges";
import { formatMoney, formatMoneyCompact } from "@/lib/utils";
import type { ProductRow, SupplierRow } from "@/lib/inventory";

type FormState = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  supplierId: string;
  unitCost: string;
  price: string;
  initialQty: string;
  reorderPoint: string;
  reorderQty: string;
};

const EMPTY: FormState = { sku: "", name: "", category: "", supplierId: "", unitCost: "", price: "", initialQty: "0", reorderPoint: "0", reorderQty: "1" };
const STATUS_FILTERS = ["All", "In stock", "Low stock", "Out of stock"] as const;

export function InventoryView({ products, suppliers }: { products: ProductRow[]; suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.sku} ${p.name} ${p.supplierName}`.toLowerCase().includes(q)) return false;
      if (category !== "All" && p.category !== category) return false;
      if (status === "In stock" && (p.quantity === 0 || p.quantity <= p.reorderPoint)) return false;
      if (status === "Low stock" && !(p.quantity > 0 && p.quantity <= p.reorderPoint)) return false;
      if (status === "Out of stock" && p.quantity !== 0) return false;
      return true;
    });
  }, [products, query, category, status]);

  function openAdd() {
    setError(null);
    setForm({ ...EMPTY, supplierId: suppliers[0]?.id ?? "" });
  }
  function openEdit(p: ProductRow) {
    setError(null);
    setForm({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      supplierId: p.supplierId,
      unitCost: String(p.unitCost),
      price: String(p.price),
      initialQty: "0",
      reorderPoint: String(p.reorderPoint),
      reorderQty: String(p.reorderQty),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    const isEdit = Boolean(form.id);
    const res = await fetch(isEdit ? `/api/products/${form.id}` : "/api/products", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: form.sku,
        name: form.name,
        category: form.category,
        supplierId: form.supplierId,
        unitCost: Number(form.unitCost),
        price: Number(form.price),
        initialQty: Number(form.initialQty),
        reorderPoint: Number(form.reorderPoint),
        reorderQty: Number(form.reorderQty),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setForm(null);
    router.refresh();
  }

  async function remove(p: ProductRow) {
    if (!confirm(`Delete ${p.sku} — ${p.name}? Its movement history goes with it.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed.");
      return;
    }
    router.refresh();
  }

  const totalValue = rows.reduce((s, p) => s + p.quantity * p.unitCost, 0);

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {products.length} SKUs · stock changes only through the ledger, never by editing a row.
          </p>
        </div>
        <button onClick={openAdd} className="btn-accent rounded-lg px-5 py-2.5 text-sm">
          + Add product
        </button>
      </div>

      {/* One filter row above the table it scopes */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search SKU, name, supplier…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === s ? "bg-[var(--accent-wash)] text-accent" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="ml-auto text-xs text-muted">
          {rows.length} shown · {formatMoneyCompact(totalValue)} on hand
        </p>
      </div>

      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2.5 pr-4 font-semibold">SKU</th>
              <th className="pb-2.5 pr-4 font-semibold">Product</th>
              <th className="pb-2.5 pr-4 font-semibold">Category</th>
              <th className="pb-2.5 pr-4 font-semibold">Supplier</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">Cost</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">Price</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">On hand</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">Sells/day</th>
              <th className="pb-2.5 pr-4 font-semibold">Status</th>
              <th className="pb-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="num py-2.5 pr-4 text-xs text-muted">{p.sku}</td>
                <td className="py-2.5 pr-4 font-semibold">{p.name}</td>
                <td className="py-2.5 pr-4 text-ink-secondary">{p.category}</td>
                <td className="py-2.5 pr-4 text-ink-secondary">{p.supplierName}</td>
                <td className="num py-2.5 pr-4 text-right">{formatMoney(p.unitCost)}</td>
                <td className="num py-2.5 pr-4 text-right">{formatMoney(p.price)}</td>
                <td className="num py-2.5 pr-4 text-right font-bold">{p.quantity}</td>
                <td className="num py-2.5 pr-4 text-right text-ink-secondary">{p.velocity30d}</td>
                <td className="py-2.5 pr-4">
                  <StockBadge quantity={p.quantity} reorderPoint={p.reorderPoint} />
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="btn-ghost rounded-md px-2.5 py-1 text-xs">
                    Edit
                  </button>{" "}
                  <button onClick={() => remove(p)} className="btn-ghost rounded-md px-2.5 py-1 text-xs text-critical">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-muted">
                  Nothing matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Add / edit modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-4" onClick={() => setForm(null)}>
          <form onSubmit={submit} className="panel w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">{form.id ? `Edit ${form.sku}` : "Add product"}</h2>

            <div className="grid grid-cols-2 gap-3">
              {!form.id && (
                <Field label="SKU">
                  <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="CAB-006" required />
                </Field>
              )}
              <Field label="Category">
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Cables & Adapters" required />
              </Field>
              <div className="col-span-2">
                <Field label="Product name">
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Supplier">
                  <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.leadTimeDays}d lead)
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Unit cost ($)">
                <input className="input" type="number" step="0.01" min="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} required />
              </Field>
              <Field label="Sell price ($)">
                <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </Field>
              {!form.id && (
                <Field label="Opening stock">
                  <input className="input" type="number" min="0" value={form.initialQty} onChange={(e) => setForm({ ...form, initialQty: e.target.value })} />
                </Field>
              )}
              <Field label="Reorder point">
                <input className="input" type="number" min="0" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} required />
              </Field>
              <Field label="Default order qty">
                <input className="input" type="number" min="1" value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} required />
              </Field>
            </div>

            {error && <p className="text-sm text-critical">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setForm(null)} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60">
                {busy ? "Saving…" : form.id ? "Save changes" : "Add product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
