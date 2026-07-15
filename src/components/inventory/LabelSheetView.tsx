"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import bwipjs from "bwip-js/browser";
import { formatMoney } from "@/lib/utils";
import type { ProductRow } from "@/lib/inventory";

// Code 128 label sheet. bwip-js renders SVG strings — no DOM juggling — and
// the grid is sized for A4 (3 columns, break-inside avoided per label).

function barcodeSvg(text: string): string {
  try {
    return bwipjs.toSVG({
      bcid: "code128",
      text,
      height: 10,
      includetext: true,
      textxalign: "center",
    });
  } catch {
    return "";
  }
}

export function LabelSheetView({ products }: { products: ProductRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(products.slice(0, 12).map((p) => p.id)));
  const [copies, setCopies] = useState(1);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const labels = useMemo(() => {
    const chosen = products.filter((p) => selected.has(p.id));
    const out: ProductRow[] = [];
    for (const p of chosen) for (let i = 0; i < copies; i++) out.push(p);
    return out;
  }, [products, selected, copies]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-8 print:max-w-none print:p-0">
      {/* Controls — never printed */}
      <div className="print-hide mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Barcode labels</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Code 128 from each product&apos;s barcode (defaults to its SKU) — print onto label sheets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/inventory" className="btn-ghost rounded-lg px-4 py-2 text-sm">
              ← Inventory
            </Link>
            <button
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60"
            >
              ⎙ Print {labels.length} label{labels.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              placeholder="Search SKU, name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              Copies each
              <input
                className="input w-20"
                type="number"
                min={1}
                max={30}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 1))))}
              />
            </label>
            <button onClick={() => setSelected(new Set(filtered.map((p) => p.id)))} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              Select all shown
            </button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              Clear
            </button>
            <p className="ml-auto text-xs text-muted">{selected.size} selected</p>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="num text-xs text-muted">{p.sku}</span>
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Label grid — the printable area */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {labels.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            className="rounded-lg border border-border bg-surface p-3 text-center print:rounded-none print:border-neutral-300"
            style={{ breakInside: "avoid" }}
          >
            <p className="truncate text-xs font-bold">{p.name}</p>
            <div
              className="mx-auto mt-1.5 [&>svg]:mx-auto [&>svg]:h-16 [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: barcodeSvg(p.barcode ?? p.sku) }}
            />
            <p className="num mt-1 text-xs text-muted">{formatMoney(p.price)}</p>
          </div>
        ))}
        {labels.length === 0 && (
          <p className="print-hide col-span-full py-10 text-center text-sm text-muted">Select products to lay out labels.</p>
        )}
      </div>
    </div>
  );
}
