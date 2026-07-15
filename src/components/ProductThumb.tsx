"use client";

import { useState } from "react";

// Product thumbnail with a graceful fallback: when there's no image (or it
// fails to load) render an initial-letter tile tinted by category. Plain
// <img> rather than next/image — image URLs are arbitrary external hosts,
// which would require remotePatterns config and optimization costs.

const TINTS = ["var(--tint-accent)", "var(--tint-good)", "var(--tint-warning)", "var(--tint-violet)", "var(--tint-critical)"];
const INKS = ["var(--accent-ink)", "var(--good)", "var(--warning)", "var(--viz-violet-ink)", "var(--critical)"];

function hashCategory(category: string): number {
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) | 0;
  return Math.abs(h) % TINTS.length;
}

export function ProductThumb({
  name,
  category,
  imageUrl,
  size = 28,
}: {
  name: string;
  category: string;
  imageUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const idx = hashCategory(category);

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts; next/image would need remotePatterns + optimization costs
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-md border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md text-xs font-bold"
      style={{ width: size, height: size, background: TINTS[idx], color: INKS[idx] }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
