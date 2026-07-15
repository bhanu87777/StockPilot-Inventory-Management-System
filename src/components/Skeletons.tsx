// Loading skeletons that mirror the real pages' panel geometry, so nothing
// jumps when data lands. Shimmer lives in globals.css (.skeleton) and
// respects prefers-reduced-motion.

export function Sk({ w = "100%", h = 14, className = "" }: { w?: string | number; h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ width: w, height: h }} aria-hidden />;
}

export function SkKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel p-5">
          <Sk w={110} h={10} />
          <Sk w={80} h={26} className="mt-3" />
          <Sk w={140} h={10} className="mt-3" />
        </div>
      ))}
    </div>
  );
}

export function SkTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel p-5" aria-busy>
      <div className="mb-4 flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <Sk key={i} w={`${100 / cols}%`} h={10} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-t border-border/60 py-3">
          {Array.from({ length: cols }, (_, c) => (
            <Sk key={c} w={`${100 / cols}%`} h={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkChart() {
  return (
    <div className="panel p-5" aria-busy>
      <Sk w={140} h={12} />
      <Sk w={220} h={10} className="mt-2" />
      <Sk h={230} className="mt-4" />
    </div>
  );
}

export function SkHeader() {
  return (
    <div className="mb-6" aria-busy>
      <Sk w={260} h={28} />
      <Sk w={380} h={12} className="mt-3" />
    </div>
  );
}
