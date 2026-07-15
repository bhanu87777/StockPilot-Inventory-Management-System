import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// Printable purchase order — deliberately outside the app shell. "Save as
// PDF" is the browser's print dialog: zero PDF dependencies.
export default async function PoPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: { select: { sku: true, name: true } } } },
    },
  });
  if (!po) notFound();

  const total = po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const units = po.items.reduce((s, i) => s + i.quantity, 0);
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const d = (x: Date | null) =>
    x ? x.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

  return (
    <div className="mx-auto max-w-[820px] px-8 py-10 print:max-w-none print:px-0 print:py-0">
      <style>{`@page { margin: 14mm; } @media print { body { background: #fff !important; } }`}</style>

      {/* Toolbar — never printed */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link href="/purchase-orders" className="btn-ghost rounded-lg px-4 py-2 text-sm">
          ← Back to purchase orders
        </Link>
        <PrintButton />
      </div>

      {/* Document */}
      <div className="rounded-xl border border-border bg-surface p-10 print:rounded-none print:border-0 print:p-0">
        <header className="mb-8 flex items-start justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <p className="font-display text-xl font-bold tracking-tight">StockPilot</p>
              <p className="text-xs text-muted">Inventory Management</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-display text-2xl font-bold tracking-tight">Purchase Order</h1>
            <p className="num mt-1 text-sm font-semibold">{po.number}</p>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-muted">{po.status}</p>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Supplier</p>
            <p className="font-semibold">{po.supplier.name}</p>
            <p className="text-sm text-ink-secondary">{po.supplier.email}</p>
            <p className="text-sm text-ink-secondary">{po.supplier.country}</p>
            <p className="mt-1 text-xs text-muted">Lead time: {po.supplier.leadTimeDays} days</p>
          </div>
          <div className="text-right">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Dates</p>
            <p className="text-sm">
              <span className="text-muted">Created:</span> {d(po.createdAt)}
            </p>
            <p className="text-sm">
              <span className="text-muted">Ordered:</span> {d(po.orderedAt)}
            </p>
            <p className="text-sm">
              <span className="text-muted">Expected:</span> {d(po.expectedAt)}
            </p>
            <p className="text-sm">
              <span className="text-muted">Received:</span> {d(po.receivedAt)}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2 pr-4 font-semibold">#</th>
              <th className="pb-2 pr-4 font-semibold">SKU</th>
              <th className="pb-2 pr-4 font-semibold">Product</th>
              <th className="pb-2 pr-4 text-right font-semibold">Qty</th>
              <th className="pb-2 pr-4 text-right font-semibold">Unit cost</th>
              <th className="pb-2 text-right font-semibold">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((i, idx) => (
              <tr key={i.id} className="border-b border-border/60">
                <td className="num py-2.5 pr-4 text-xs text-muted">{idx + 1}</td>
                <td className="num py-2.5 pr-4 text-xs">{i.product.sku}</td>
                <td className="py-2.5 pr-4 font-semibold">{i.product.name}</td>
                <td className="num py-2.5 pr-4 text-right">{i.quantity}</td>
                <td className="num py-2.5 pr-4 text-right">{fmt(i.unitCost)}</td>
                <td className="num py-2.5 text-right font-semibold">{fmt(i.quantity * i.unitCost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-xs text-muted">
                {po.items.length} lines · {units.toLocaleString()} units
              </td>
              <td colSpan={2} className="pt-4 text-right text-sm font-bold">
                Total
              </td>
              <td className="num pt-4 text-right text-base font-bold">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">
          Generated by StockPilot · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </footer>
      </div>
    </div>
  );
}
