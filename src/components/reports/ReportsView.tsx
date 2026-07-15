"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatMoneyCompact } from "@/lib/utils";
import type { ValuationRow } from "@/lib/reports";

const GROUPS = ["category", "supplierName"] as const;
type GroupKey = (typeof GROUPS)[number];

export function ReportsView({ valuation }: { valuation: ValuationRow[] }) {
  const [groupBy, setGroupBy] = useState<GroupKey>("category");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, { rows: ValuationRow[]; total: number }>();
    for (const r of valuation) {
      const key = r[groupBy];
      const g = map.get(key) ?? { rows: [], total: 0 };
      g.rows.push(r);
      g.total += r.value;
      map.set(key, g);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [valuation, groupBy]);

  const grandTotal = valuation.reduce((s, r) => s + r.value, 0);

  const movementHref = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (type) params.set("type", type);
    const qs = params.toString();
    return `/api/reports/movements${qs ? `?${qs}` : ""}`;
  }, [from, to, type]);

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Valuation, movement history, and PO history — every export is a plain CSV that opens in Excel.
        </p>
      </div>

      {/* Export cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-5">
          <h3 className="text-sm font-bold">Stock valuation</h3>
          <p className="mt-1 text-xs text-muted">Every SKU with on-hand, per-warehouse split, and value at cost.</p>
          <a href="/api/reports/valuation" className="btn-accent mt-4 inline-block rounded-lg px-4 py-2 text-sm">
            ⇓ Download CSV
          </a>
        </div>
        <div className="panel p-5">
          <h3 className="text-sm font-bold">Movement history</h3>
          <p className="mt-1 text-xs text-muted">The full ledger in a date range — uncapped, with lot and operator.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="input w-auto py-1.5 text-xs" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span className="text-xs text-muted">→</span>
            <input className="input w-auto py-1.5 text-xs" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            <select className="input w-auto py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option>IN</option>
              <option>OUT</option>
              <option>ADJUST</option>
              <option>TRANSFER_IN</option>
              <option>TRANSFER_OUT</option>
            </select>
          </div>
          <a href={movementHref} className="btn-accent mt-3 inline-block rounded-lg px-4 py-2 text-sm">
            ⇓ Download CSV
          </a>
        </div>
        <div className="panel p-5">
          <h3 className="text-sm font-bold">Purchase orders</h3>
          <p className="mt-1 text-xs text-muted">Every PO with line count, units, cost, and status dates.</p>
          <a href="/api/reports/purchase-orders" className="btn-accent mt-4 inline-block rounded-lg px-4 py-2 text-sm">
            ⇓ Download CSV
          </a>
        </div>
      </div>

      {/* Valuation table */}
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Valuation — {formatMoneyCompact(grandTotal)} on hand</h3>
            <p className="mt-0.5 text-xs text-muted">quantity × unit cost, grouped with subtotals</p>
          </div>
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  groupBy === g ? "bg-[var(--accent-wash)] text-accent" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {g === "category" ? "By category" : "By supplier"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                <th className="pb-2.5 pr-4 font-semibold">Product</th>
                <th className="pb-2.5 pr-4 text-right font-semibold">On hand</th>
                <th className="pb-2.5 pr-4 font-semibold">Per warehouse</th>
                <th className="pb-2.5 pr-4 text-right font-semibold">Unit cost</th>
                <th className="pb-2.5 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([key, g]) => (
                <GroupRows key={key} label={key} rows={g.rows} total={g.total} />
              ))}
              <tr>
                <td colSpan={5} className="py-3 pr-4 text-right text-sm font-bold">
                  Grand total
                </td>
                <td className="num py-3 text-right text-sm font-bold">{formatMoney(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GroupRows({ label, rows, total }: { label: string; rows: ValuationRow[]; total: number }) {
  return (
    <>
      <tr className="bg-surface-2">
        <td colSpan={5} className="py-2 pr-4 text-xs font-bold uppercase tracking-wider text-ink-secondary">
          {label}
        </td>
        <td className="num py-2 text-right text-xs font-bold">{formatMoney(total)}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.sku} className="border-b border-border/60 last:border-0">
          <td className="num py-2 pr-4 text-xs text-muted">{r.sku}</td>
          <td className="py-2 pr-4 font-semibold">{r.name}</td>
          <td className="num py-2 pr-4 text-right">{r.quantity}</td>
          <td className="num py-2 pr-4 text-xs text-muted">{r.perWarehouse || "—"}</td>
          <td className="num py-2 pr-4 text-right">{formatMoney(r.unitCost)}</td>
          <td className="num py-2 text-right font-bold">{formatMoney(r.value)}</td>
        </tr>
      ))}
    </>
  );
}
