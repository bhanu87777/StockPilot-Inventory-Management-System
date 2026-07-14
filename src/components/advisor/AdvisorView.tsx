"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UrgencyBadge } from "@/components/Badges";

export type AdvisorRunView = {
  id: string;
  summary: string;
  source: string;
  createdAt: string;
  suggestions: {
    id: string;
    productName: string;
    sku: string;
    urgency: string;
    suggestedQty: number;
    daysOfCover: number;
    rationale: string;
  }[];
} | null;

export function AdvisorView({ run }: { run: AdvisorRunView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/advisor", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Planner failed — check the server logs.");
      return;
    }
    router.refresh();
  }

  const critical = run?.suggestions.filter((s) => s.urgency === "CRITICAL") ?? [];
  const soon = run?.suggestions.filter((s) => s.urgency === "SOON") ?? [];
  const dead = run?.suggestions.filter((s) => s.urgency === "DEAD") ?? [];

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Reorder advisor</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            30-day velocity × supplier lead time × on-hand cover, ranked by what bites first.
          </p>
        </div>
        <button onClick={generate} disabled={busy} className="btn-accent rounded-lg px-5 py-2.5 text-sm disabled:opacity-60">
          {busy ? "Scanning the catalog…" : run ? "Re-run the planner" : "Run the planner"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-critical">{error}</p>}

      {!run ? (
        <div className="panel flex flex-col items-center gap-3 p-14 text-center">
          <p className="font-display text-2xl font-bold">No plan yet</p>
          <p className="max-w-md text-sm text-ink-secondary">
            Run the planner to rank every SKU by stockout risk and flag dead stock. Uses the Claude API when a key is
            configured, with a transparent heuristic fallback.
          </p>
        </div>
      ) : (
        <>
          <section className="panel mb-5 p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Plan summary</h3>
              <span className="rounded-full border border-border-strong px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                {run.source === "AI" ? "Claude planner" : "Heuristic planner"} ·{" "}
                {new Date(run.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-ink-secondary">{run.summary}</p>
          </section>

          {[
            { title: "Order now", desc: "Will stock out before a replenishment can arrive", items: critical },
            { title: "Order this week", desc: "Cover runs out shortly after the lead time", items: soon },
            { title: "Dead stock", desc: "No demand — cash tied up on the shelf", items: dead },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.title} className="mb-6">
                  <h3 className="mb-1 font-display text-lg font-bold">{group.title}</h3>
                  <p className="mb-3 text-xs text-muted">{group.desc}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {group.items.map((s) => (
                      <article key={s.id} className="panel panel-hover p-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="num text-xs text-muted">{s.sku}</span>
                          <UrgencyBadge urgency={s.urgency} />
                        </div>
                        <h4 className="mb-1 text-[15px] font-bold">{s.productName}</h4>
                        <p className="mb-3 text-sm leading-relaxed text-ink-secondary">{s.rationale}</p>
                        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                          <span className="text-muted">
                            {s.daysOfCover >= 999 ? "No demand" : `~${s.daysOfCover} days of cover`}
                          </span>
                          {s.suggestedQty > 0 ? (
                            <span className="num font-bold">
                              Suggest ordering <span className="text-accent">{s.suggestedQty}</span> units
                            </span>
                          ) : (
                            <span className="font-semibold text-muted">Do not reorder</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )
          )}

          {run.suggestions.length === 0 && (
            <div className="panel p-10 text-center text-sm text-muted">
              Every SKU is healthy — nothing to order and no dead stock. 🎉
            </div>
          )}

          <p className="mt-2 text-xs text-muted">
            Ready to act? <Link href="/purchase-orders" className="font-semibold text-accent hover:underline">Create a purchase order →</Link>
          </p>
        </>
      )}
    </div>
  );
}
