import { getSuppliers, getProducts } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, products] = await Promise.all([getSuppliers(), getProducts()]);
  const lowBySupplier = new Map<string, number>();
  for (const p of products) {
    if (p.quantity <= p.reorderPoint) {
      lowBySupplier.set(p.supplierId, (lowBySupplier.get(p.supplierId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Lead times drive the advisor&apos;s urgency math — a 21-day supplier needs three weeks of warning.
        </p>
      </div>

      <section className="panel overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2.5 pr-4 font-semibold">Supplier</th>
              <th className="pb-2.5 pr-4 font-semibold">Contact</th>
              <th className="pb-2.5 pr-4 font-semibold">Country</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">Lead time</th>
              <th className="pb-2.5 pr-4 text-right font-semibold">SKUs</th>
              <th className="pb-2.5 text-right font-semibold">Low-stock SKUs</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const low = lowBySupplier.get(s.id) ?? 0;
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-semibold">{s.name}</td>
                  <td className="py-3 pr-4 text-ink-secondary">{s.email}</td>
                  <td className="py-3 pr-4 text-ink-secondary">{s.country}</td>
                  <td className="num py-3 pr-4 text-right">{s.leadTimeDays} days</td>
                  <td className="num py-3 pr-4 text-right">{s.skuCount}</td>
                  <td className={`num py-3 text-right font-bold ${low > 0 ? "text-critical" : "text-good"}`}>{low}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
