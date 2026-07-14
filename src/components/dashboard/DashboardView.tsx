"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, ChartTooltip, LegendKeys, VIZ, gridProps, axisTick, axisLine, cursorLine } from "@/components/charts/chartKit";
import { StockBadge, MovementBadge } from "@/components/Badges";
import { formatMoneyCompact, dateTimeLabel } from "@/lib/utils";
import type { ProductRow, MovementRow } from "@/lib/inventory";

export function DashboardView({
  products,
  flows,
  recentMovements,
  openPoValue,
  openPoCount,
}: {
  products: ProductRow[];
  flows: { week: string; in: number; out: number }[];
  recentMovements: MovementRow[];
  openPoValue: number;
  openPoCount: number;
}) {
  const stockValue = products.reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const low = products.filter((p) => p.quantity > 0 && p.quantity <= p.reorderPoint);
  const out = products.filter((p) => p.quantity === 0);
  const alerts = [...out, ...low];

  // Stock value by category (single series — one color, no legend box).
  const byCategory = new Map<string, number>();
  for (const p of products) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.quantity * p.unitCost);
  const categoryData = [...byCategory.entries()]
    .map(([category, value]) => ({ category, Value: Math.round(value) }))
    .sort((a, b) => b.Value - a.Value);

  const flowData = flows.map((f) => ({ week: f.week, "Units in": f.in, "Units out": f.out }));

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Warehouse overview</h1>
        <p className="mt-1 text-sm text-ink-secondary">Live position derived from the movement ledger.</p>
      </div>

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Inventory value" value={formatMoneyCompact(stockValue)} sub="on-hand units × unit cost" />
        <Stat label="Active SKUs" value={String(products.length)} sub={`across ${byCategory.size} categories`} />
        <Stat
          label="Stock alerts"
          value={String(alerts.length)}
          sub={`${out.length} out of stock · ${low.length} low`}
          tone={alerts.length > 0 ? "warn" : "ok"}
        />
        <Stat label="Open PO value" value={formatMoneyCompact(openPoValue)} sub={`${openPoCount} draft / in transit`} />
      </div>

      {/* Charts */}
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Units in vs out"
          subtitle="Weekly ledger totals, last 12 weeks"
          right={<LegendKeys items={[{ label: "Units in", color: VIZ.aqua, shape: "rect" }, { label: "Units out", color: VIZ.blue, shape: "rect" }]} />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" tick={axisTick} axisLine={axisLine} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={cursorLine} />
                <Area type="monotone" dataKey="Units in" stroke={VIZ.aqua} strokeWidth={2} fill={VIZ.aqua} fillOpacity={0.1} isAnimationActive={false} />
                <Area type="monotone" dataKey="Units out" stroke={VIZ.blue} strokeWidth={2} fill={VIZ.blue} fillOpacity={0.1} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Stock value by category" subtitle="Where the cash is sitting right now">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="category" tick={axisTick} axisLine={axisLine} tickLine={false} interval={0} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatMoneyCompact(v)} width={52} />
                <Tooltip content={<ChartTooltip format={(v) => formatMoneyCompact(v)} />} cursor={{ fill: "rgba(16,24,40,0.04)" }} />
                <Bar dataKey="Value" fill={VIZ.blue} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Alerts + recent movements */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="panel panel-hover p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Stock alerts</h3>
              <p className="mt-0.5 text-xs text-muted">At or below reorder point — sorted worst first</p>
            </div>
            <Link href="/advisor" className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              Ask the advisor →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2.5 pr-4 font-semibold">SKU</th>
                  <th className="pb-2.5 pr-4 font-semibold">Product</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">On hand</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Reorder at</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="num py-2.5 pr-4 text-xs text-muted">{p.sku}</td>
                    <td className="py-2.5 pr-4 font-semibold">{p.name}</td>
                    <td className="num py-2.5 pr-4 text-right font-bold">{p.quantity}</td>
                    <td className="num py-2.5 pr-4 text-right text-ink-secondary">{p.reorderPoint}</td>
                    <td className="py-2.5">
                      <StockBadge quantity={p.quantity} reorderPoint={p.reorderPoint} />
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted">
                      Nothing at or below its reorder point. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel panel-hover p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Recent movements</h3>
              <p className="mt-0.5 text-xs text-muted">Latest entries in the ledger</p>
            </div>
            <Link href="/movements" className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              Full ledger →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2.5 pr-4 font-semibold">When</th>
                  <th className="pb-2.5 pr-4 font-semibold">Product</th>
                  <th className="pb-2.5 pr-4 font-semibold">Type</th>
                  <th className="pb-2.5 pr-4 text-right font-semibold">Qty</th>
                  <th className="pb-2.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 text-xs text-ink-secondary">{dateTimeLabel(m.occurredAt)}</td>
                    <td className="py-2.5 pr-4 font-semibold">{m.productName}</td>
                    <td className="py-2.5 pr-4">
                      <MovementBadge type={m.type} />
                    </td>
                    <td className="num py-2.5 pr-4 text-right font-bold">
                      {m.type === "ADJUST" && m.quantity > 0 ? "+" : ""}
                      {m.type === "OUT" ? `−${m.quantity}` : m.quantity}
                    </td>
                    <td className="num py-2.5 text-right text-ink-secondary">{m.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warn" | "ok" }) {
  return (
    <div className="panel panel-hover p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1.5 text-[1.75rem] font-bold leading-none ${tone === "warn" ? "text-critical" : ""}`}>{value}</p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </div>
  );
}
