import { requireAuth } from "@/lib/rbac";
import { toCsv, csvResponse } from "@/lib/csv";
import { getValuationReport } from "@/lib/reports";

// GET /api/reports/valuation — stock valuation CSV (any authenticated role).
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const rows = await getValuationReport();
  const csv = toCsv(
    ["SKU", "Product", "Category", "Supplier", "On hand", "Per warehouse", "Unit cost", "Value", "Status"],
    rows.map((r) => [r.sku, r.name, r.category, r.supplierName, r.quantity, r.perWarehouse, r.unitCost, r.value, r.status])
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`stockpilot-valuation-${stamp}.csv`, csv);
}
