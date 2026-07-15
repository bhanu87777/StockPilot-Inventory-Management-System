"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv";
import type { ProductRow, SupplierRow } from "@/lib/inventory";

// CSV product importer: parse client-side, preview with per-row validation,
// then POST only the valid rows. The server re-validates and commits
// all-or-nothing.

const HEADERS = ["sku", "name", "category", "supplier", "unit_cost", "price", "initial_qty", "reorder_point", "reorder_qty", "image_url"];
const TEMPLATE =
  HEADERS.join(",") + "\r\n" + "ACC-005,Desk Cable Tray,Accessories,Baltic Electronics OÜ,4.50,16,120,30,80,\r\n";

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  error: string | null;
};

export function ImportDialog({
  products,
  suppliers,
  onClose,
}: {
  products: ProductRow[];
  suppliers: SupplierRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const existingSkus = useMemo(() => new Set(products.map((p) => p.sku.toUpperCase())), [products]);
  const supplierNames = useMemo(() => new Map(suppliers.map((s) => [s.name.toLowerCase(), s.name])), [suppliers]);

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockpilot-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) {
      setError("The file needs a header row and at least one data row.");
      setRows(null);
      return;
    }
    // Header mapping — case/space/underscore tolerant.
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const headerIdx = new Map(grid[0].map((h, i) => [norm(h), i]));
    const missing = ["sku", "name", "category", "supplier"].filter((h) => !headerIdx.has(h));
    if (missing.length > 0) {
      setError(`Missing required columns: ${missing.join(", ")}. Download the template for the expected format.`);
      setRows(null);
      return;
    }

    const seen = new Set<string>();
    const parsed: ParsedRow[] = grid.slice(1).map((cells, i) => {
      const get = (h: string) => {
        const idx = headerIdx.get(h);
        return idx === undefined ? "" : (cells[idx] ?? "").trim();
      };
      const raw: Record<string, string> = {
        sku: get("sku").toUpperCase(),
        name: get("name"),
        category: get("category"),
        supplier: get("supplier"),
        unitCost: get("unit_cost"),
        price: get("price"),
        initialQty: get("initial_qty") || "0",
        reorderPoint: get("reorder_point") || "0",
        reorderQty: get("reorder_qty") || "1",
        imageUrl: get("image_url"),
      };

      let err: string | null = null;
      if (!raw.sku || !raw.name || !raw.category) err = "SKU, name, and category are required";
      else if (seen.has(raw.sku)) err = "Duplicate SKU within the file";
      else if (existingSkus.has(raw.sku)) err = "SKU already exists in the catalog";
      else if (!supplierNames.has(raw.supplier.toLowerCase())) err = `Unknown supplier "${raw.supplier}"`;
      else if (!Number.isFinite(Number(raw.unitCost)) || Number(raw.unitCost) < 0) err = "Bad unit_cost";
      else if (!Number.isFinite(Number(raw.price)) || Number(raw.price) < 0) err = "Bad price";
      seen.add(raw.sku);
      return { index: i, raw, error: err };
    });
    setRows(parsed);
  }

  const valid = rows?.filter((r) => !r.error) ?? [];

  async function submit() {
    if (valid.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: valid.map((r) => ({
          ...r.raw,
          supplier: supplierNames.get(r.raw.supplier.toLowerCase()),
          unitCost: Number(r.raw.unitCost),
          price: Number(r.raw.price),
          initialQty: Number(r.raw.initialQty),
          reorderPoint: Number(r.raw.reorderPoint),
          reorderQty: Number(r.raw.reorderQty),
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Import failed.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={onClose}>
      <div className="panel max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Import products from CSV</h2>
            <p className="mt-1 text-xs text-muted">
              Suppliers are matched by name; each product lands with its opening balance in the ledger.
            </p>
          </div>
          <button onClick={downloadTemplate} className="btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs">
            ⇓ Template
          </button>
        </div>

        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-[var(--accent-bright)] bg-[var(--accent-wash)]" : "border-border-strong"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-sm font-semibold">{fileName || "Drop a CSV here, or click to browse"}</p>
          <p className="mt-1 text-xs text-muted">sku, name, category, supplier, unit_cost, price, initial_qty, …</p>
        </label>

        {rows && (
          <>
            <p className="text-sm">
              <span className="font-bold text-good">{valid.length}</span> of {rows.length} rows importable
              {rows.length - valid.length > 0 && (
                <span className="text-critical"> · {rows.length - valid.length} with errors (skipped)</span>
              )}
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="text-left uppercase tracking-wider text-muted">
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Supplier</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.index} className="border-t border-border/60">
                      <td className="num px-3 py-1.5">{r.raw.sku}</td>
                      <td className="px-3 py-1.5">{r.raw.name}</td>
                      <td className="px-3 py-1.5 text-muted">{r.raw.supplier}</td>
                      <td className="num px-3 py-1.5 text-right">{r.raw.initialQty}</td>
                      <td className="px-3 py-1.5">
                        {r.error ? (
                          <span className="font-semibold text-critical">⨯ {r.error}</span>
                        ) : (
                          <span className="font-semibold text-good">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || valid.length === 0}
            className="btn-accent rounded-lg px-5 py-2 text-sm disabled:opacity-60"
          >
            {busy ? "Importing…" : `Import ${valid.length} product${valid.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
