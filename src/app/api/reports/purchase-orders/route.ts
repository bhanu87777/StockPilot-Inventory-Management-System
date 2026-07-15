import { requireAuth } from "@/lib/rbac";
import { toCsv, csvResponse } from "@/lib/csv";
import { getPoReport } from "@/lib/reports";

// GET /api/reports/purchase-orders — PO history CSV (any authenticated role).
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const rows = await getPoReport();
  const csv = toCsv(
    ["Number", "Status", "Supplier", "Lines", "Units", "Total cost", "Created", "Ordered", "Expected", "Received"],
    rows.map((po) => [
      po.number,
      po.status,
      po.supplier.name,
      po.items.length,
      po.items.reduce((s, i) => s + i.quantity, 0),
      Math.round(po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0) * 100) / 100,
      po.createdAt.toISOString().slice(0, 10),
      po.orderedAt?.toISOString().slice(0, 10) ?? "",
      po.expectedAt?.toISOString().slice(0, 10) ?? "",
      po.receivedAt?.toISOString().slice(0, 10) ?? "",
    ])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`stockpilot-purchase-orders-${stamp}.csv`, csv);
}
