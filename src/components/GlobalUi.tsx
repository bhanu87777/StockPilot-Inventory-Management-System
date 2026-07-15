"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { useTheme } from "./ThemeProvider";
import type { Role } from "@/lib/permissions";

// Global keyboard layer, mounted once in the (app) layout:
//   Ctrl/Cmd+K  command palette         /   focus the page's search box
//   g then d/i/m/w/p/o/s/c/a/r          n then p/m/o  create things
//   t           toggle theme            ?   this help overlay
const GO: Record<string, string> = {
  d: "/dashboard",
  i: "/inventory",
  m: "/movements",
  w: "/warehouses",
  p: "/purchase-orders",
  o: "/sales-orders",
  s: "/suppliers",
  c: "/customers",
  a: "/advisor",
  r: "/reports",
};
const NEW: Record<string, string> = {
  p: "/inventory?new=1",
  m: "/movements?focus=record",
  o: "/purchase-orders?new=1",
  s: "/sales-orders?new=1",
};

export function GlobalUi({ role }: { role?: Role }) {
  const router = useRouter();
  const { toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const chord = useRef<{ key: string; at: number } | null>(null);

  const closeAll = useCallback(() => {
    setPaletteOpen(false);
    setHelpOpen(false);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+K works everywhere, even inside inputs.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setHelpOpen(false);
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        closeAll();
        return;
      }
      // Everything else is inert while typing or while an overlay is open.
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;
      if (paletteOpen || helpOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const pending = chord.current && now - chord.current.at < 1000 ? chord.current.key : null;
      chord.current = null;

      if (pending === "g" && GO[e.key]) {
        e.preventDefault();
        router.push(GO[e.key]);
        return;
      }
      if (pending === "n" && NEW[e.key]) {
        e.preventDefault();
        router.push(NEW[e.key]);
        return;
      }

      if (e.key === "g" || e.key === "n") {
        chord.current = { key: e.key, at: now };
        return;
      }
      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-shortcut-search], input[placeholder^='Search']");
        if (search) {
          e.preventDefault();
          search.focus();
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (e.key === "t") {
        toggle();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, toggle, paletteOpen, helpOpen, closeAll]);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Command palette" },
  { keys: ["/"], label: "Focus search on the page" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["t"], label: "Toggle dark mode" },
  { keys: ["g", "d"], label: "Go to Dashboard" },
  { keys: ["g", "i"], label: "Go to Inventory" },
  { keys: ["g", "m"], label: "Go to Movements" },
  { keys: ["g", "w"], label: "Go to Warehouses" },
  { keys: ["g", "p"], label: "Go to Purchase orders" },
  { keys: ["g", "o"], label: "Go to Sales orders" },
  { keys: ["g", "s"], label: "Go to Suppliers" },
  { keys: ["g", "c"], label: "Go to Customers" },
  { keys: ["g", "a"], label: "Go to Reorder advisor" },
  { keys: ["g", "r"], label: "Go to Reports" },
  { keys: ["n", "p"], label: "Add product" },
  { keys: ["n", "m"], label: "Record movement" },
  { keys: ["n", "o"], label: "New purchase order" },
  { keys: ["n", "s"], label: "New sales order" },
];

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="panel w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-lg font-bold">Keyboard shortcuts</h2>
        <div className="grid max-h-[60vh] grid-cols-1 gap-y-2 overflow-y-auto sm:grid-cols-2 sm:gap-x-8">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-secondary">{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="kbd">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-ghost mt-5 w-full rounded-lg px-4 py-2 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}
