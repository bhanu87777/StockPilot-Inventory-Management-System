"use client";

/*
  Shared chart chrome. Colors are CSS-variable references, so both validated
  palettes (light on #fcfcfb, dark on #171a20 — see globals.css) swap with the
  theme with zero JS. Recharts passes these straight into SVG props, where
  var() resolves natively. Fixed order — never cycled. Sub-3:1 hues mean every
  chart pairs with a legend and the page keeps a table view of the same data.
*/
export const VIZ = {
  blue: "var(--viz-1)",
  aqua: "var(--viz-2)",
  yellow: "var(--viz-3)",
  violet: "var(--viz-4)",
  red: "var(--viz-5)",
  orange: "var(--viz-6)",
} as const;

export const SURFACE = "var(--surface)";
export const GRID = "var(--grid)";
export const AXIS = "var(--axis)";
export const MUTED = "var(--muted)";
export const INK = "var(--ink)";
export const INK_SECONDARY = "var(--ink-secondary)";

export const gridProps = { stroke: GRID, strokeWidth: 1, vertical: false } as const;
export const axisTick = { fill: MUTED, fontSize: 11 } as const;
export const axisLine = { stroke: AXIS, strokeWidth: 1 } as const;
export const cursorLine = { stroke: AXIS, strokeWidth: 1 } as const;

type Formatter = (value: number, name: string) => string;

// Recharts 3 injects these at render time; typed explicitly since the
// library's TooltipProps reads them from context.
type TooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; name?: string | number; color?: string }>;
  label?: string | number;
  format?: Formatter;
};

// One tooltip, every series: value leads, label follows, keyed by a short
// stroke of the series color. Rendered as React text — untrusted strings stay inert.
export function ChartTooltip({ active, payload, label, format }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fmt: Formatter = format ?? ((v) => v.toLocaleString("en-US"));
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        padding: "9px 11px",
        boxShadow: "var(--tooltip-shadow)",
      }}
    >
      {label !== undefined && <p style={{ color: MUTED, fontSize: 11, marginBottom: 5 }}>{String(label)}</p>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i === 0 ? 0 : 4 }}>
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: p.color ?? INK, flexShrink: 0 }} />
            <span style={{ color: INK, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt(Number(p.value), String(p.name))}
            </span>
            <span style={{ color: INK_SECONDARY, fontSize: 12 }}>{String(p.name)}</span>
          </div>
        ))}
    </div>
  );
}

// Minimal legend: colored key + label in secondary ink (text never wears the
// series color).
export function LegendKeys({
  items,
}: {
  items: { label: string; color: string; shape?: "line" | "rect" | "dot" }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2 text-xs text-ink-secondary">
          {it.shape === "rect" ? (
            <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />
          ) : it.shape === "dot" ? (
            <span style={{ width: 8, height: 8, borderRadius: 99, background: it.color }} />
          ) : (
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel panel-hover flex flex-col p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
