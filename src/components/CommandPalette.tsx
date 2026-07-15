"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fuzzyScore } from "@/lib/fuzzy";
import { NAV } from "@/lib/nav";
import { can, type Role } from "@/lib/permissions";
import { useTheme } from "./ThemeProvider";
import { ProductThumb } from "./ProductThumb";
import type { SearchHit } from "@/lib/search";

type Command = { id: string; label: string; hint: string; run: () => void };
type Item =
  | { kind: "command"; group: string; command: Command }
  | { kind: "hit"; group: string; hit: SearchHit };

const RECENTS_KEY = "sp-recent-commands";

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// The palette remounts on every open (keyed by `open` in the parent), so all
// state starts fresh without reset effects.
export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role?: Role }) {
  if (!open) return null;
  return <PaletteInner onClose={onClose} role={role} />;
}

function PaletteInner({ onClose, role }: { onClose: () => void; role?: Role }) {
  const router = useRouter();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [recents] = useState<string[]>(loadRecents);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const commands = useMemo<Command[]>(() => {
    const nav = NAV.filter((n) => !n.action || can(role, n.action)).map((n) => ({
      id: `nav:${n.href}`,
      label: `Go to ${n.label}`,
      hint: n.href,
      run: () => go(n.href),
    }));
    const actions: Command[] = [
      { id: "act:new-product", label: "Add product", hint: "/inventory?new=1", run: () => go("/inventory?new=1") },
      { id: "act:record-movement", label: "Record movement", hint: "/movements?focus=record", run: () => go("/movements?focus=record") },
      { id: "act:new-po", label: "New purchase order", hint: "/purchase-orders?new=1", run: () => go("/purchase-orders?new=1") },
      { id: "act:new-so", label: "New sales order", hint: "/sales-orders?new=1", run: () => go("/sales-orders?new=1") },
      { id: "act:import-csv", label: "Import products from CSV", hint: "/inventory?import=1", run: () => go("/inventory?import=1") },
      { id: "act:print-labels", label: "Print barcode labels", hint: "/inventory/labels", run: () => go("/inventory/labels") },
      {
        id: "act:toggle-theme",
        label: "Toggle dark mode",
        hint: "t",
        run: () => {
          toggle();
          onClose();
        },
      },
    ];
    return [...actions, ...nav];
  }, [role, go, toggle, onClose]);

  // Debounced server search — state only changes in the async callback.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          setHits(data.hits ?? []);
        }
      } catch {
        // aborted or offline — keep previous hits
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const shownHits = q.length < 2 ? [] : hits;
    let cmds: Command[];
    if (q) {
      cmds = commands
        .map((c) => ({ c, score: fuzzyScore(q, c.label) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.c);
    } else {
      const recentSet = new Set(recents);
      cmds = [...commands.filter((c) => recentSet.has(c.id)), ...commands.filter((c) => !recentSet.has(c.id))];
    }
    const commandItems: Item[] = cmds.slice(0, q ? 6 : 9).map((c) => ({
      kind: "command",
      group: !q && recents.includes(c.id) ? "Recent" : "Commands",
      command: c,
    }));
    const hitItems: Item[] = shownHits.map((h) => ({ kind: "hit", group: h.group, hit: h }));
    return [...commandItems, ...hitItems];
  }, [commands, q, hits, recents]);

  // Clamp instead of resetting in an effect; typing resets via onChange.
  const activeIdx = items.length === 0 ? 0 : Math.min(active, items.length - 1);

  const execute = useCallback(
    (item: Item) => {
      if (item.kind === "command") {
        try {
          const next = [item.command.id, ...loadRecents().filter((r) => r !== item.command.id)].slice(0, 8);
          localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
        } catch {}
        item.command.run();
      } else {
        go(item.hit.href);
      }
    },
    [go]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIdx + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIdx - 1 + Math.max(1, items.length)) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[activeIdx]) execute(items[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--overlay)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="panel mx-auto mt-[12vh] w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="w-full border-b border-border bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-muted"
          placeholder="Search products, orders, pages… or type a command"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[activeIdx] ? `palette-item-${activeIdx}` : undefined}
        />
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {items.map((item, i) => {
            const group = item.group;
            const header = group !== lastGroup ? group : null;
            lastGroup = group;
            return (
              <li key={item.kind === "command" ? item.command.id : `${item.hit.group}:${item.hit.id}`}>
                {header && (
                  <p className="px-5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted">{header}</p>
                )}
                <button
                  id={`palette-item-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => execute(item)}
                  className={`flex w-full items-center gap-3 px-5 py-2 text-left text-sm ${
                    i === activeIdx ? "bg-[var(--accent-wash)]" : ""
                  }`}
                >
                  {item.kind === "hit" && item.hit.group === "Products" ? (
                    <ProductThumb name={item.hit.label} category={item.hit.category ?? "?"} imageUrl={item.hit.imageUrl ?? null} size={24} />
                  ) : (
                    <span className="w-6 text-center text-muted" aria-hidden>
                      {item.kind === "command" ? "⌘" : "◦"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {item.kind === "command" ? item.command.label : item.hit.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {item.kind === "command" ? item.command.hint : item.hit.sublabel}
                  </span>
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">No matches.</li>}
        </ul>
        <div className="flex items-center gap-3 border-t border-border px-5 py-2 text-[10px] text-muted">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navigate
          </span>
          <span>
            <kbd className="kbd">↵</kbd> open
          </span>
          <span>
            <kbd className="kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
