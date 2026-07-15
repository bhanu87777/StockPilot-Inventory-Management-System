"use client";

import { useRef, useState } from "react";
import type { ProductRow } from "@/lib/inventory";

// USB barcode scanners are keyboard wedges: they type the code fast and send
// Enter. A focused input is all the hardware integration needed — on Enter we
// look the code up against barcode/SKU and hand the product to the form.
export function ScanInput({ products, onMatch }: { products: ProductRow[]; onMatch: (p: ProductRow) => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "miss">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = value.trim().toUpperCase();
    if (!code) return;
    const product = products.find((p) => (p.barcode ?? "").toUpperCase() === code || p.sku.toUpperCase() === code);
    if (product) {
      onMatch(product);
      setStatus("ok");
      setValue("");
    } else {
      setStatus("miss");
    }
    // Re-focus for batch scanning workflows.
    inputRef.current?.focus();
  }

  return (
    <div>
      <input
        ref={inputRef}
        className="input"
        placeholder="⌖ Scan barcode — or type a SKU and press Enter"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        onKeyDown={onKeyDown}
        aria-label="Scan or type a barcode"
      />
      {status === "ok" && <p className="mt-1 text-xs text-good">✓ Matched — form prefilled</p>}
      {status === "miss" && <p className="mt-1 text-xs text-critical">⨯ No product with that barcode or SKU</p>}
    </div>
  );
}
