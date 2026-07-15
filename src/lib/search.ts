import { prisma } from "./prisma";

// Server-backed entity search for the command palette. Case-insensitive
// contains over the entities worth jumping to, capped per group.

export type SearchHit = {
  id: string;
  group: "Products" | "Suppliers" | "Customers" | "Purchase orders" | "Sales orders" | "Warehouses";
  label: string;
  sublabel: string;
  href: string;
  imageUrl?: string | null;
  category?: string;
};

export async function searchEntities(q: string): Promise<SearchHit[]> {
  const take = 6;
  const contains = { contains: q, mode: "insensitive" as const };

  const [products, suppliers, customers, pos, sos, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ name: contains }, { sku: contains }, { barcode: contains }] },
      select: { id: true, sku: true, name: true, quantity: true, imageUrl: true, category: true },
      take,
      orderBy: { sku: "asc" },
    }),
    prisma.supplier.findMany({
      where: { name: contains },
      select: { id: true, name: true, country: true },
      take,
    }),
    prisma.customer.findMany({
      where: { name: contains },
      select: { id: true, name: true, country: true },
      take,
    }),
    prisma.purchaseOrder.findMany({
      where: { number: contains },
      select: { id: true, number: true, status: true, supplier: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesOrder.findMany({
      where: { number: contains },
      select: { id: true, number: true, status: true, customer: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.warehouse.findMany({
      where: { OR: [{ code: contains }, { name: contains }] },
      select: { id: true, code: true, name: true },
      take,
    }),
  ]);

  return [
    ...products.map((p): SearchHit => ({
      id: p.id,
      group: "Products",
      label: `${p.sku} — ${p.name}`,
      sublabel: `${p.quantity} on hand`,
      href: `/inventory?q=${encodeURIComponent(p.sku)}`,
      imageUrl: p.imageUrl,
      category: p.category,
    })),
    ...suppliers.map((s): SearchHit => ({
      id: s.id,
      group: "Suppliers",
      label: s.name,
      sublabel: s.country,
      href: "/suppliers",
    })),
    ...customers.map((c): SearchHit => ({
      id: c.id,
      group: "Customers",
      label: c.name,
      sublabel: c.country,
      href: "/customers",
    })),
    ...pos.map((po): SearchHit => ({
      id: po.id,
      group: "Purchase orders",
      label: po.number,
      sublabel: `${po.status} · ${po.supplier.name}`,
      href: "/purchase-orders",
    })),
    ...sos.map((so): SearchHit => ({
      id: so.id,
      group: "Sales orders",
      label: so.number,
      sublabel: `${so.status} · ${so.customer.name}`,
      href: "/sales-orders",
    })),
    ...warehouses.map((w): SearchHit => ({
      id: w.id,
      group: "Warehouses",
      label: `${w.code} — ${w.name}`,
      sublabel: "Warehouse",
      href: "/warehouses",
    })),
  ];
}
