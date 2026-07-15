// Status is never color alone — every badge carries an icon + label.

export function StockBadge({ quantity, reorderPoint }: { quantity: number; reorderPoint: number }) {
  if (quantity === 0) {
    return <Badge cls="bg-[var(--tint-critical)] text-critical" icon="⨯" label="Out of stock" />;
  }
  if (quantity <= reorderPoint) {
    return <Badge cls="bg-[var(--tint-warning)] text-warning" icon="⚠" label="Low stock" />;
  }
  return <Badge cls="bg-[var(--tint-good)] text-good" icon="✓" label="In stock" />;
}

export function MovementBadge({ type }: { type: string }) {
  if (type === "IN") return <Badge cls="bg-[var(--tint-good)] text-good" icon="↓" label="IN" />;
  if (type === "OUT") return <Badge cls="bg-[var(--tint-accent)] text-accent" icon="↑" label="OUT" />;
  if (type === "TRANSFER_OUT") return <Badge cls="bg-[var(--tint-violet)] text-[var(--viz-violet-ink)]" icon="⇢" label="XFER OUT" />;
  if (type === "TRANSFER_IN") return <Badge cls="bg-[var(--tint-violet)] text-[var(--viz-violet-ink)]" icon="⇠" label="XFER IN" />;
  return <Badge cls="bg-[var(--tint-violet)] text-[var(--viz-violet-ink)]" icon="±" label="ADJUST" />;
}

export function PoBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    DRAFT: { cls: "bg-surface-2 text-ink-secondary", icon: "✎", label: "Draft" },
    ORDERED: { cls: "bg-[var(--tint-accent)] text-accent", icon: "⇢", label: "Ordered" },
    RECEIVED: { cls: "bg-[var(--tint-good)] text-good", icon: "✓", label: "Received" },
    CANCELLED: { cls: "bg-[var(--tint-critical)] text-critical", icon: "⨯", label: "Cancelled" },
  };
  const s = map[status] ?? map.DRAFT;
  return <Badge cls={s.cls} icon={s.icon} label={s.label} />;
}

export function SoBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    DRAFT: { cls: "bg-surface-2 text-ink-secondary", icon: "✎", label: "Draft" },
    CONFIRMED: { cls: "bg-[var(--tint-accent)] text-accent", icon: "⇢", label: "Confirmed" },
    FULFILLED: { cls: "bg-[var(--tint-good)] text-good", icon: "✓", label: "Fulfilled" },
    CANCELLED: { cls: "bg-[var(--tint-critical)] text-critical", icon: "⨯", label: "Cancelled" },
  };
  const s = map[status] ?? map.DRAFT;
  return <Badge cls={s.cls} icon={s.icon} label={s.label} />;
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    CRITICAL: { cls: "bg-[var(--tint-critical)] text-critical", icon: "⨯", label: "Critical" },
    SOON: { cls: "bg-[var(--tint-warning)] text-warning", icon: "⚠", label: "Order soon" },
    OK: { cls: "bg-[var(--tint-good)] text-good", icon: "✓", label: "Healthy" },
    DEAD: { cls: "bg-surface-2 text-ink-secondary", icon: "◔", label: "Dead stock" },
  };
  const s = map[urgency] ?? map.OK;
  return <Badge cls={s.cls} icon={s.icon} label={s.label} />;
}

export function ExpiryBadge({ daysToExpiry }: { daysToExpiry: number }) {
  if (daysToExpiry < 0) return <Badge cls="bg-[var(--tint-critical)] text-critical" icon="⨯" label="Expired" />;
  if (daysToExpiry <= 30) return <Badge cls="bg-[var(--tint-warning)] text-warning" icon="⚠" label={`${daysToExpiry}d left`} />;
  return <Badge cls="bg-[var(--tint-good)] text-good" icon="✓" label={`${daysToExpiry}d left`} />;
}

function Badge({ cls, icon, label }: { cls: string; icon: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
