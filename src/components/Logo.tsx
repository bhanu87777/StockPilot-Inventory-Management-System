// The StockPilot mark: three stacked crates with a motion chevron.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="6" y="24" width="12" height="10" rx="2" fill="#1c5cab" />
      <rect x="20" y="24" width="12" height="10" rx="2" fill="#2a78d6" opacity="0.55" />
      <rect x="13" y="12" width="12" height="10" rx="2" fill="#2a78d6" />
      <path d="M28 8 L34 14 L28 20" fill="none" stroke="#1c5cab" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
