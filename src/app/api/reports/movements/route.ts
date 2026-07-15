import { requireAuth } from "@/lib/rbac";
import { toCsv, csvResponse } from "@/lib/csv";
import { getMovementReport } from "@/lib/reports";

// GET /api/reports/movements?from=YYYY-MM-DD&to=YYYY-MM-DD&type=OUT —
// movement history CSV (any authenticated role).
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  // `to` is inclusive: bump to end of day.
  const to = toRaw ? new Date(new Date(toRaw).getTime() + 86_399_000) : undefined;
  const type = url.searchParams.get("type") ?? undefined;

  const rows = await getMovementReport({
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
    type,
  });
  const csv = toCsv(
    ["When", "SKU", "Product", "Warehouse", "Type", "Qty", "Balance", "Reason", "Reference", "Lot", "By"],
    rows.map((m) => [
      m.occurredAt.toISOString(),
      m.product.sku,
      m.product.name,
      m.warehouse.code,
      m.type,
      m.quantity,
      m.balance,
      m.reason,
      m.reference,
      m.lot?.lotCode ?? "",
      m.createdBy?.email ?? "",
    ])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`stockpilot-movements-${stamp}.csv`, csv);
}
