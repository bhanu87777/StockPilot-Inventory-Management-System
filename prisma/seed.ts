import { PrismaClient, MovementType, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic PRNG so every reseed produces the same warehouse.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260710);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const NOW = new Date(Date.UTC(2026, 6, 10, 12, 0, 0)); // seed "today"
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, hour = 10) => new Date(NOW.getTime() - n * DAY + hour * 3600 * 1000 - 12 * 3600 * 1000);

const SUPPLIERS = [
  { name: "Shenzhen Nova Components", email: "orders@sznova.cn", country: "China", leadTimeDays: 21 },
  { name: "Baltic Electronics OÜ", email: "sales@balticelec.ee", country: "Estonia", leadTimeDays: 9 },
  { name: "Kaizen Audio Works", email: "b2b@kaizenaudio.jp", country: "Japan", leadTimeDays: 14 },
  { name: "Rhine Cable GmbH", email: "vertrieb@rhinecable.de", country: "Germany", leadTimeDays: 7 },
  { name: "Pacific Power Labs", email: "wholesale@pacpower.tw", country: "Taiwan", leadTimeDays: 18 },
  { name: "Nordic Peripherals AB", email: "orders@nordicper.se", country: "Sweden", leadTimeDays: 10 },
];

const CUSTOMERS = [
  { name: "Northwind Retail Group", email: "purchasing@northwindretail.example", country: "Singapore" },
  { name: "Volt & Byte Stores", email: "orders@voltbyte.example", country: "Malaysia" },
  { name: "Cirrus Office Supply", email: "b2b@cirrusoffice.example", country: "Singapore" },
  { name: "Gadget Harbour", email: "buy@gadgetharbour.example", country: "Indonesia" },
  { name: "Apex E-tail Pte Ltd", email: "supply@apexetail.example", country: "Singapore" },
  { name: "Mercury Campus Store", email: "store@mercurycampus.example", country: "Thailand" },
  { name: "Kite Electronics", email: "wholesale@kiteelec.example", country: "Vietnam" },
  { name: "Beacon Hotels Procurement", email: "procurement@beaconhotels.example", country: "Singapore" },
];

// velocity = typical units sold per day. Profiles create the stories the
// dashboard and advisor need: fast movers, steady movers, and dead stock.
type SeedProduct = {
  sku: string; name: string; category: string; unitCost: number; price: number;
  supplier: number; velocity: number; startQty: number; reorderPoint: number; reorderQty: number;
  perishable?: { shelfLifeDays: number };
  imageSeed?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  { sku: "AUD-001", name: "Studio Monitor Headphones", category: "Audio", unitCost: 48, price: 119, supplier: 2, velocity: 3.2, startQty: 420, reorderPoint: 80, reorderQty: 200, imageSeed: true },
  { sku: "AUD-002", name: "True Wireless Earbuds Pro", category: "Audio", unitCost: 26, price: 79, supplier: 2, velocity: 6.5, startQty: 700, reorderPoint: 150, reorderQty: 400, imageSeed: true },
  { sku: "AUD-003", name: "USB Condenser Microphone", category: "Audio", unitCost: 31, price: 89, supplier: 2, velocity: 1.8, startQty: 220, reorderPoint: 50, reorderQty: 120 },
  { sku: "AUD-004", name: "Bluetooth Party Speaker XL", category: "Audio", unitCost: 62, price: 159, supplier: 2, velocity: 1.1, startQty: 140, reorderPoint: 30, reorderQty: 80 },
  { sku: "COM-001", name: "Mechanical Keyboard TKL", category: "Computing", unitCost: 38, price: 99, supplier: 5, velocity: 4.1, startQty: 500, reorderPoint: 100, reorderQty: 250, imageSeed: true },
  { sku: "COM-002", name: "Wireless Ergonomic Mouse", category: "Computing", unitCost: 14, price: 39, supplier: 5, velocity: 5.8, startQty: 640, reorderPoint: 140, reorderQty: 350, imageSeed: true },
  { sku: "COM-003", name: "1080p Streaming Webcam", category: "Computing", unitCost: 19, price: 55, supplier: 5, velocity: 2.4, startQty: 260, reorderPoint: 60, reorderQty: 150 },
  { sku: "COM-004", name: "Laptop Stand Aluminium", category: "Computing", unitCost: 12, price: 34, supplier: 5, velocity: 2.9, startQty: 320, reorderPoint: 70, reorderQty: 180 },
  { sku: "COM-005", name: "27\" QHD IPS Monitor", category: "Computing", unitCost: 118, price: 249, supplier: 0, velocity: 1.6, startQty: 190, reorderPoint: 45, reorderQty: 100, imageSeed: true },
  { sku: "CAB-001", name: "USB-C to HDMI Cable 2m", category: "Cables & Adapters", unitCost: 4.2, price: 15, supplier: 3, velocity: 8.4, startQty: 900, reorderPoint: 220, reorderQty: 500, imageSeed: true },
  { sku: "CAB-002", name: "USB-C Hub 7-in-1", category: "Cables & Adapters", unitCost: 13, price: 42, supplier: 3, velocity: 4.6, startQty: 480, reorderPoint: 110, reorderQty: 260 },
  { sku: "CAB-003", name: "Braided Lightning Cable 1m", category: "Cables & Adapters", unitCost: 2.8, price: 12, supplier: 3, velocity: 7.2, startQty: 760, reorderPoint: 190, reorderQty: 450 },
  { sku: "CAB-004", name: "Ethernet Cat-6 Cable 5m", category: "Cables & Adapters", unitCost: 3.1, price: 11, supplier: 3, velocity: 3.4, startQty: 380, reorderPoint: 90, reorderQty: 220 },
  { sku: "SMH-001", name: "Smart Plug (2-pack)", category: "Smart Home", unitCost: 9, price: 27, supplier: 0, velocity: 3.8, startQty: 420, reorderPoint: 95, reorderQty: 240, imageSeed: true },
  { sku: "SMH-002", name: "Wi-Fi Video Doorbell", category: "Smart Home", unitCost: 34, price: 95, supplier: 0, velocity: 1.9, startQty: 210, reorderPoint: 50, reorderQty: 120 },
  { sku: "SMH-003", name: "Smart LED Bulb E27 RGBW", category: "Smart Home", unitCost: 5.5, price: 19, supplier: 0, velocity: 5.1, startQty: 540, reorderPoint: 130, reorderQty: 300 },
  { sku: "SMH-004", name: "Zigbee Motion Sensor", category: "Smart Home", unitCost: 8, price: 25, supplier: 0, velocity: 1.4, startQty: 160, reorderPoint: 40, reorderQty: 100 },
  { sku: "PWR-001", name: "65W GaN Charger", category: "Power", unitCost: 11, price: 36, supplier: 4, velocity: 5.4, startQty: 580, reorderPoint: 130, reorderQty: 320, imageSeed: true },
  { sku: "PWR-002", name: "20,000mAh Power Bank", category: "Power", unitCost: 16, price: 49, supplier: 4, velocity: 4.2, startQty: 460, reorderPoint: 105, reorderQty: 260 },
  { sku: "PWR-003", name: "Wireless Charging Pad 15W", category: "Power", unitCost: 8.5, price: 29, supplier: 4, velocity: 2.6, startQty: 300, reorderPoint: 65, reorderQty: 170 },
  { sku: "PWR-004", name: "UPS 850VA Line-Interactive", category: "Power", unitCost: 58, price: 139, supplier: 4, velocity: 0.9, startQty: 120, reorderPoint: 25, reorderQty: 60 },
  { sku: "ACC-001", name: "Adjustable Phone Tripod", category: "Accessories", unitCost: 7, price: 24, supplier: 1, velocity: 2.2, startQty: 250, reorderPoint: 60, reorderQty: 140 },
  { sku: "ACC-002", name: "Laptop Sleeve 14\" Felt", category: "Accessories", unitCost: 6, price: 22, supplier: 1, velocity: 1.7, startQty: 200, reorderPoint: 45, reorderQty: 110 },
  { sku: "ACC-003", name: "Cable Management Kit", category: "Accessories", unitCost: 3.5, price: 14, supplier: 1, velocity: 3.1, startQty: 340, reorderPoint: 80, reorderQty: 200 },
  { sku: "ACC-004", name: "Screen Cleaning Kit Pro", category: "Accessories", unitCost: 2.2, price: 9, supplier: 1, velocity: 2.8, startQty: 310, reorderPoint: 75, reorderQty: 180 },
  // Perishables — lot-tracked consumables (FEFO stories) ↓
  { sku: "CON-001", name: "Screen Cleaner Fluid 250ml", category: "Consumables", unitCost: 1.8, price: 7, supplier: 1, velocity: 2.4, startQty: 320, reorderPoint: 70, reorderQty: 180, perishable: { shelfLifeDays: 365 } },
  { sku: "CON-002", name: "Thermal Paste 4g Syringe", category: "Consumables", unitCost: 3.2, price: 12, supplier: 1, velocity: 1.6, startQty: 200, reorderPoint: 45, reorderQty: 110, perishable: { shelfLifeDays: 70 } }, // lot expiring in ~10 days
  { sku: "CON-003", name: "AA Alkaline Batteries 24-pack", category: "Consumables", unitCost: 6.5, price: 18, supplier: 1, velocity: 3.4, startQty: 420, reorderPoint: 95, reorderQty: 240, perishable: { shelfLifeDays: 540 } },
  { sku: "CON-004", name: "CR2032 Coin Cells 10-pack", category: "Consumables", unitCost: 2.4, price: 9, supplier: 1, velocity: 1.9, startQty: 240, reorderPoint: 55, reorderQty: 130, perishable: { shelfLifeDays: 540 } },
  { sku: "CON-005", name: "Compressed Air Duster 400ml", category: "Consumables", unitCost: 2.9, price: 11, supplier: 1, velocity: 1.2, startQty: 160, reorderPoint: 35, reorderQty: 90, perishable: { shelfLifeDays: 180 } }, // has an expired remnant lot
  // Engineered stories ↓
  { sku: "COM-006", name: "4K Capture Card", category: "Computing", unitCost: 52, price: 129, supplier: 5, velocity: 2.1, startQty: 96, reorderPoint: 55, reorderQty: 130 }, // critical: runs out during lead time
  { sku: "AUD-005", name: "Vinyl Turntable Classic", category: "Audio", unitCost: 74, price: 189, supplier: 2, velocity: 0.08, startQty: 64, reorderPoint: 10, reorderQty: 30 }, // dead stock
  { sku: "SMH-005", name: "Smart IR Remote Hub", category: "Smart Home", unitCost: 12, price: 35, supplier: 0, velocity: 0.05, startQty: 88, reorderPoint: 15, reorderQty: 50 }, // dead stock
  { sku: "PWR-005", name: "Solar Camping Charger", category: "Power", unitCost: 21, price: 59, supplier: 4, velocity: 1.3, startQty: 42, reorderPoint: 35, reorderQty: 90 }, // low, reorder soon
  { sku: "CAB-005", name: "Thunderbolt 4 Cable 1m", category: "Cables & Adapters", unitCost: 15, price: 45, supplier: 3, velocity: 1.9, startQty: 28, reorderPoint: 40, reorderQty: 110 }, // below reorder point now
];

const ENGINEERED = new Set(["COM-006", "PWR-005", "CAB-005", "AUD-005", "SMH-005"]);
const OUT_REASONS = ["Online order", "Retail order", "B2B order", "Marketplace order"];
const ADJ_REASONS = ["Cycle count correction", "Damaged in warehouse", "Customer return restock", "Shrinkage write-off"];

type MoveRow = {
  type: MovementType;
  quantity: number;
  balance: number;
  reason: string;
  reference: string | null;
  occurredAt: Date;
  warehouseId: string;
  lotId?: string | null;
  createdById?: string | null;
};

async function main() {
  console.log("Seeding StockPilot v2…");

  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reorderSuggestion.deleteMany();
  await prisma.advisorRun.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  // ── Users (one per role) ────────────────────────────────────────────────
  const password = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.create({
    data: { email: "demo@stockpilot.app", name: "Demo Operator", role: "ADMIN", password, createdAt: daysAgo(120) },
  });
  const purchasing = await prisma.user.create({
    data: { email: "purchasing@stockpilot.app", name: "Priya Purchasing", role: "PURCHASING", password, createdAt: daysAgo(95) },
  });
  await prisma.user.create({
    data: { email: "viewer@stockpilot.app", name: "Vik Viewer", role: "VIEWER", password, createdAt: daysAgo(60) },
  });
  const operators = [demo, purchasing];

  // ── Warehouses ──────────────────────────────────────────────────────────
  const main = await prisma.warehouse.create({
    data: { code: "MAIN", name: "Central Warehouse", city: "Singapore", isDefault: true },
  });
  const east = await prisma.warehouse.create({
    data: { code: "EAST", name: "East Fulfillment Hub", city: "Johor Bahru" },
  });
  const outlet = await prisma.warehouse.create({
    data: { code: "OUT", name: "Outlet Store", city: "Singapore" },
  });

  const suppliers = [];
  for (const s of SUPPLIERS) suppliers.push(await prisma.supplier.create({ data: s }));

  const customers = [];
  for (const c of CUSTOMERS) customers.push(await prisma.customer.create({ data: { ...c, createdAt: daysAgo(int(30, 110)) } }));

  // ── Products + 90-day replay ────────────────────────────────────────────
  let moveCount = 0;
  let soSeq = 101;
  const soSales: { number: string; productId: string; qty: number; price: number; date: Date; customerIdx: number }[] = [];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const products: Array<{
    id: string; sku: string; supplierId: string; unitCost: number; price: number;
    quantity: number; balances: { main: number; east: number; out: number }; seed: SeedProduct;
  }> = [];

  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        unitCost: p.unitCost,
        price: p.price,
        quantity: 0, // set true balance after replaying the ledger
        reorderPoint: p.reorderPoint,
        reorderQty: p.reorderQty,
        barcode: p.sku,
        imageUrl: p.imageSeed ? `https://picsum.photos/seed/${p.sku}/240/240` : null,
        isPerishable: !!p.perishable,
        shelfLifeDays: p.perishable?.shelfLifeDays ?? null,
        supplierId: suppliers[p.supplier].id,
      },
    });

    const rows: MoveRow[] = [];

    // MAIN: opening balance, daily sales, scheduled replenishment cycles,
    // and occasional adjustments — the original warehouse story.
    let bal = p.startQty;
    rows.push({ type: "IN", quantity: p.startQty, balance: bal, reason: "Opening balance", reference: null, occurredAt: daysAgo(90, 8), warehouseId: main.id });

    const engineered = ENGINEERED.has(p.sku);
    const restockDays = new Set<number>();
    if (!engineered && p.velocity >= 1.5) {
      const cycles = Math.max(1, Math.min(3, Math.floor((p.velocity * 90) / p.reorderQty)));
      for (let i = 1; i <= cycles; i++) restockDays.add(int(10, 80));
    }

    for (let d = 89; d >= 0; d--) {
      const date = daysAgo(d, int(9, 18));
      const weekday = date.getUTCDay();
      const mult = weekday === 0 || weekday === 6 ? 0.55 : 1;
      let sold = Math.round(p.velocity * mult * between(0.4, 1.7));
      if (sold > 0) {
        sold = Math.min(sold, bal);
        // The "low but not out" stories settle just under the reorder point
        // instead of draining to zero.
        if (p.sku === "PWR-005" || p.sku === "CAB-005") {
          sold = Math.min(sold, Math.max(0, bal - Math.floor(p.reorderPoint * 0.55)));
        }
        if (sold > 0) {
          bal -= sold;
          // A slice of recent outbound is retro-tagged to real sales orders
          // so the ledger's references genuinely resolve.
          let reference: string | null = null;
          if (d <= 45 && rand() < 0.045) {
            reference = `SO-2026-0${soSeq++}`;
            soSales.push({ number: reference, productId: product.id, qty: sold, price: p.price, date, customerIdx: int(0, customers.length - 1) });
          }
          rows.push({ type: "OUT", quantity: sold, balance: bal, reason: pick(OUT_REASONS), reference, occurredAt: date, warehouseId: main.id });
        }
      }
      if (restockDays.has(d) || (!engineered && d > 12 && bal < p.reorderPoint && rand() < 0.5)) {
        const qty = p.reorderQty;
        bal += qty;
        rows.push({ type: "IN", quantity: qty, balance: bal, reason: "PO received", reference: `PO-2026-0${int(100, 399)}`, occurredAt: daysAgo(d, 9), warehouseId: main.id });
        restockDays.delete(d);
      }
      if (rand() < 0.012) {
        const delta = pick([-3, -2, -1, 1, 2]);
        if (bal + delta >= 0) {
          bal += delta;
          rows.push({ type: "ADJUST", quantity: delta, balance: bal, reason: pick(ADJ_REASONS), reference: null, occurredAt: daysAgo(d, 19), warehouseId: main.id });
        }
      }
    }

    // EAST / OUT: satellite sites carry a slice of the fast movers with a
    // sparser sales cadence (engineered stories stay MAIN-only so their
    // totals keep telling the right story).
    let balE = 0;
    let balO = 0;
    if (!engineered && p.velocity >= 2) {
      balE = Math.floor(p.startQty * between(0.1, 0.25));
      rows.push({ type: "IN", quantity: balE, balance: balE, reason: "Opening balance", reference: null, occurredAt: daysAgo(85, 8), warehouseId: east.id });
      for (let d = 84; d >= 0; d--) {
        if (rand() < 0.15) {
          const sold = Math.min(Math.max(1, Math.round(p.velocity * between(0.2, 0.6))), balE);
          if (sold > 0) {
            balE -= sold;
            rows.push({ type: "OUT", quantity: sold, balance: balE, reason: pick(OUT_REASONS), reference: null, occurredAt: daysAgo(d, int(10, 17)), warehouseId: east.id });
          }
        }
      }
      if (p.velocity >= 3.5) {
        balO = Math.floor(p.startQty * between(0.04, 0.1));
        rows.push({ type: "IN", quantity: balO, balance: balO, reason: "Opening balance", reference: null, occurredAt: daysAgo(80, 8), warehouseId: outlet.id });
        for (let d = 79; d >= 0; d--) {
          if (rand() < 0.08) {
            const sold = Math.min(int(1, 3), balO);
            if (sold > 0) {
              balO -= sold;
              rows.push({ type: "OUT", quantity: sold, balance: balO, reason: "Retail order", reference: null, occurredAt: daysAgo(d, int(11, 19)), warehouseId: outlet.id });
            }
          }
        }
      }
    }

    // Recent movements carry an operator (older history predates attribution).
    for (const r of rows) {
      if (NOW.getTime() - r.occurredAt.getTime() <= 14 * DAY) {
        r.createdById = pick(operators).id;
      }
    }

    await prisma.stockMovement.createMany({ data: rows.map((r) => ({ ...r, productId: product.id })) });
    moveCount += rows.length;

    products.push({
      id: product.id, sku: p.sku, supplierId: suppliers[p.supplier].id,
      unitCost: p.unitCost, price: p.price,
      quantity: bal + balE + balO, balances: { main: bal, east: balE, out: balO }, seed: p,
    });
  }

  const bySku = (sku: string) => products.find((x) => x.sku === sku)!;

  // ── Transfers: recent rebalancing stories (TR pairs at the timeline's end,
  //    so every balance snapshot stays consistent) ─────────────────────────
  let trSeq = 1;
  const transferStories = [
    { sku: "AUD-002", qty: 40, hoursAgo: 30 },
    { sku: "CAB-001", qty: 60, hoursAgo: 26 },
    { sku: "COM-002", qty: 35, hoursAgo: 20 },
    { sku: "PWR-001", qty: 30, hoursAgo: 8 },
  ];
  for (const t of transferStories) {
    const pr = bySku(t.sku);
    if (pr.balances.main < t.qty) continue;
    const when = new Date(NOW.getTime() - t.hoursAgo * 3600 * 1000);
    const ref = `TR-2026-${String(trSeq++).padStart(4, "0")}`;
    pr.balances.main -= t.qty;
    pr.balances.east += t.qty;
    await prisma.stockMovement.createMany({
      data: [
        { productId: pr.id, warehouseId: main.id, type: "TRANSFER_OUT", quantity: t.qty, balance: pr.balances.main, reason: "Warehouse transfer", reference: ref, occurredAt: when, createdById: purchasing.id },
        { productId: pr.id, warehouseId: east.id, type: "TRANSFER_IN", quantity: t.qty, balance: pr.balances.east, reason: "Warehouse transfer", reference: ref, occurredAt: when, createdById: purchasing.id },
      ],
    });
    moveCount += 2;
    auditRows.push({
      userId: purchasing.id, userEmail: purchasing.email, action: "transfer.create", entityType: "StockMovement",
      summary: `Transferred ${t.qty} × ${t.sku} MAIN → EAST (${ref})`, createdAt: when,
    });
  }

  // ── Stock levels + product totals ───────────────────────────────────────
  for (const pr of products) {
    const levels = [
      { warehouseId: main.id, quantity: pr.balances.main },
      { warehouseId: east.id, quantity: pr.balances.east },
      { warehouseId: outlet.id, quantity: pr.balances.out },
    ].filter((l) => l.quantity > 0 || l.warehouseId === main.id);
    for (const l of levels) {
      await prisma.stockLevel.create({ data: { productId: pr.id, warehouseId: l.warehouseId, quantity: l.quantity } });
    }
    pr.quantity = pr.balances.main + pr.balances.east + pr.balances.out;
    await prisma.product.update({ where: { id: pr.id }, data: { quantity: pr.quantity } });
  }

  // ── Lots for the perishable SKUs (FEFO stories) ─────────────────────────
  // qtyRemaining across lots never exceeds the MAIN level; lot ledger
  // attribution starts with live usage (history predates lot tracking).
  let lotCount = 0;
  for (const pr of products) {
    if (!pr.seed.perishable) continue;
    const shelf = pr.seed.perishable.shelfLifeDays;
    const balMain = pr.balances.main;
    if (balMain <= 0) continue;

    const newerRem = Math.ceil(balMain * 0.6);
    const olderRem = balMain - newerRem;
    const mkCode = (d: Date, n: number) =>
      `LOT-${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(n).padStart(3, "0")}`;

    const olderReceived = daysAgo(60);
    const newerReceived = daysAgo(20);
    if (olderRem > 0) {
      await prisma.lot.create({
        data: {
          productId: pr.id, warehouseId: main.id, lotCode: mkCode(olderReceived, 1),
          receivedAt: olderReceived,
          expiryDate: new Date(olderReceived.getTime() + shelf * DAY), // CON-002 (70d shelf): expires in ~10 days
          qtyReceived: olderRem + int(20, 60), qtyRemaining: olderRem,
        },
      });
      lotCount++;
    }
    if (newerRem > 0) {
      await prisma.lot.create({
        data: {
          productId: pr.id, warehouseId: main.id, lotCode: mkCode(newerReceived, 2),
          receivedAt: newerReceived,
          expiryDate: new Date(newerReceived.getTime() + shelf * DAY),
          qtyReceived: newerRem + int(0, 30), qtyRemaining: newerRem,
        },
      });
      lotCount++;
    }
  }
  // Expired remnant: a forgotten duster lot that should have been written off.
  {
    const duster = bySku("CON-005");
    if (duster.balances.main >= 8) {
      const received = daysAgo(200);
      // Shrink the newer lot so remaining still sums <= the MAIN level.
      const newest = await prisma.lot.findFirst({ where: { productId: duster.id }, orderBy: { receivedAt: "desc" } });
      if (newest && newest.qtyRemaining > 8) {
        await prisma.lot.update({ where: { id: newest.id }, data: { qtyRemaining: newest.qtyRemaining - 8 } });
        await prisma.lot.create({
          data: {
            productId: duster.id, warehouseId: main.id, lotCode: "LOT-2512-001",
            receivedAt: received,
            expiryDate: new Date(received.getTime() + 180 * DAY), // expired ~20 days ago
            qtyReceived: 90, qtyRemaining: 8,
          },
        });
        lotCount++;
      }
    }
  }

  // ── Purchase orders: received history + open orders for low-stock SKUs ──
  let poSeq = 401;
  const mkNumber = () => `PO-2026-0${poSeq++}`;

  let lastReceivedPoId = "";
  for (const group of [
    { supplier: 3, items: ["CAB-001", "CAB-002", "CAB-003"], daysOrdered: 34, daysReceived: 26 },
    { supplier: 4, items: ["PWR-001", "PWR-002"], daysOrdered: 21, daysReceived: 5 },
  ]) {
    const number = mkNumber();
    const po = await prisma.purchaseOrder.create({
      data: {
        number,
        status: "RECEIVED",
        supplierId: suppliers[group.supplier].id,
        createdAt: daysAgo(group.daysOrdered + 2),
        orderedAt: daysAgo(group.daysOrdered),
        expectedAt: daysAgo(group.daysReceived + 1),
        receivedAt: daysAgo(group.daysReceived),
        items: {
          create: group.items.map((sku) => {
            const pr = bySku(sku);
            return { productId: pr.id, quantity: pr.seed.reorderQty, unitCost: pr.unitCost };
          }),
        },
      },
    });
    lastReceivedPoId = po.id;
    const units = group.items.reduce((s, sku) => s + bySku(sku).seed.reorderQty, 0);
    auditRows.push(
      { userId: purchasing.id, userEmail: purchasing.email, action: "po.create", entityType: "PurchaseOrder", entityId: po.id, summary: `Created draft ${number} (${group.items.length} lines)`, createdAt: daysAgo(group.daysOrdered + 2) },
      { userId: purchasing.id, userEmail: purchasing.email, action: "po.order", entityType: "PurchaseOrder", entityId: po.id, summary: `Marked ${number} as ordered (${group.items.length} lines)`, createdAt: daysAgo(group.daysOrdered) },
      { userId: demo.id, userEmail: demo.email, action: "po.receive", entityType: "PurchaseOrder", entityId: po.id, summary: `Received ${number} into MAIN (${group.items.length} lines, +${units} units)`, createdAt: daysAgo(group.daysReceived) }
    );
  }

  // One ORDERED (in transit) for the critical capture card.
  const cc = bySku("COM-006");
  const inTransitNumber = mkNumber();
  const inTransit = await prisma.purchaseOrder.create({
    data: {
      number: inTransitNumber,
      status: "ORDERED",
      supplierId: cc.supplierId,
      createdAt: daysAgo(6),
      orderedAt: daysAgo(5),
      expectedAt: daysAgo(-6), // due in 6 days
      items: { create: [{ productId: cc.id, quantity: cc.seed.reorderQty, unitCost: cc.unitCost }] },
    },
  });
  auditRows.push(
    { userId: purchasing.id, userEmail: purchasing.email, action: "po.create", entityType: "PurchaseOrder", entityId: inTransit.id, summary: `Created draft ${inTransitNumber} (1 line)`, createdAt: daysAgo(6) },
    { userId: purchasing.id, userEmail: purchasing.email, action: "po.order", entityType: "PurchaseOrder", entityId: inTransit.id, summary: `Marked ${inTransitNumber} as ordered (1 line)`, createdAt: daysAgo(5) }
  );

  // One DRAFT with the two other low SKUs.
  const draftNumber = mkNumber();
  const draftPo = await prisma.purchaseOrder.create({
    data: {
      number: draftNumber,
      status: "DRAFT",
      supplierId: suppliers[3].id,
      createdAt: daysAgo(1),
      items: {
        create: ["CAB-005", "PWR-005"].map((sku) => {
          const pr = bySku(sku);
          return { productId: pr.id, quantity: pr.seed.reorderQty, unitCost: pr.unitCost };
        }),
      },
    },
  });
  auditRows.push({ userId: purchasing.id, userEmail: purchasing.email, action: "po.create", entityType: "PurchaseOrder", entityId: draftPo.id, summary: `Created draft ${draftNumber} (2 lines)`, createdAt: daysAgo(1) });

  // ── Sales orders ─────────────────────────────────────────────────────────
  // Historical FULFILLED SOs retro-tagged from the replay's OUT rows: the
  // ledger references and these rows genuinely match.
  let soCount = 0;
  for (const sale of soSales) {
    const so = await prisma.salesOrder.create({
      data: {
        number: sale.number,
        status: "FULFILLED",
        customerId: customers[sale.customerIdx].id,
        warehouseId: main.id,
        createdAt: new Date(sale.date.getTime() - 2 * DAY),
        confirmedAt: new Date(sale.date.getTime() - 1 * DAY),
        fulfilledAt: sale.date,
        items: { create: [{ productId: sale.productId, quantity: sale.qty, unitPrice: sale.price }] },
      },
    });
    soCount++;
    if (NOW.getTime() - sale.date.getTime() <= 10 * DAY) {
      auditRows.push({
        userId: demo.id, userEmail: demo.email, action: "so.fulfill", entityType: "SalesOrder", entityId: so.id,
        summary: `Fulfilled ${sale.number} from MAIN (1 line, −${sale.qty} units)`, createdAt: sale.date,
      });
    }
  }

  // Open pipeline: 1 DRAFT, 2 CONFIRMED (one deliberately oversized vs EAST
  // stock → the fulfill button demos the atomic 409), 1 CANCELLED.
  const mkSoNumber = () => `SO-2026-0${soSeq++}`;
  const earbuds = bySku("AUD-002");
  const hub = bySku("CAB-002");
  const keyboard = bySku("COM-001");

  await prisma.salesOrder.create({
    data: {
      number: mkSoNumber(), status: "DRAFT",
      customerId: customers[0].id, warehouseId: main.id, createdAt: daysAgo(0, 9),
      items: { create: [{ productId: hub.id, quantity: 25, unitPrice: hub.price }] },
    },
  });
  await prisma.salesOrder.create({
    data: {
      number: mkSoNumber(), status: "CONFIRMED",
      customerId: customers[4].id, warehouseId: main.id, createdAt: daysAgo(2), confirmedAt: daysAgo(1),
      items: {
        create: [
          { productId: keyboard.id, quantity: 30, unitPrice: keyboard.price },
          { productId: hub.id, quantity: 15, unitPrice: hub.price },
        ],
      },
    },
  });
  await prisma.salesOrder.create({
    data: {
      number: mkSoNumber(), status: "CONFIRMED",
      customerId: customers[7].id, warehouseId: east.id, createdAt: daysAgo(3), confirmedAt: daysAgo(2),
      // Oversized on purpose: EAST can't cover it — fulfilling demos the 409.
      items: { create: [{ productId: earbuds.id, quantity: earbuds.balances.east + 50, unitPrice: earbuds.price }] },
    },
  });
  await prisma.salesOrder.create({
    data: {
      number: mkSoNumber(), status: "CANCELLED",
      customerId: customers[2].id, warehouseId: main.id, createdAt: daysAgo(9),
      items: { create: [{ productId: earbuds.id, quantity: 10, unitPrice: earbuds.price }] },
    },
  });
  soCount += 4;

  // ── Audit backfill: recent movements + user management ──────────────────
  const recentMoves = await prisma.stockMovement.findMany({
    where: { createdById: { not: null }, type: { in: ["IN", "OUT", "ADJUST"] } },
    orderBy: { occurredAt: "desc" },
    take: 25,
    include: { product: { select: { sku: true } }, warehouse: { select: { code: true } }, createdBy: true },
  });
  for (const m of recentMoves) {
    auditRows.push({
      userId: m.createdById, userEmail: m.createdBy?.email ?? "unknown", action: "movement.create",
      entityType: "StockMovement", entityId: m.id,
      summary: `${m.type} ${Math.abs(m.quantity)} × ${m.product.sku} @ ${m.warehouse.code} — ${m.reason}`,
      createdAt: m.occurredAt,
    });
  }
  auditRows.push(
    { userId: demo.id, userEmail: demo.email, action: "user.create", entityType: "User", entityId: purchasing.id, summary: "Created user purchasing@stockpilot.app as PURCHASING", createdAt: daysAgo(95) },
    { userId: demo.id, userEmail: demo.email, action: "user.create", entityType: "User", entityId: null, summary: "Created user viewer@stockpilot.app as VIEWER", createdAt: daysAgo(60) },
    { userId: demo.id, userEmail: demo.email, action: "product.update", entityType: "Product", entityId: bySku("COM-005").id, summary: "Updated COM-005 (price)", createdAt: daysAgo(12) }
  );
  await prisma.auditLog.createMany({ data: auditRows });

  // ── Notifications: what the bell shows on first login ───────────────────
  const notif = async (data: Prisma.NotificationUncheckedCreateInput) => prisma.notification.create({ data });
  let notifCount = 0;

  for (const pr of products) {
    if (pr.quantity === 0) {
      await notif({
        type: "STOCKOUT",
        title: `${pr.sku} is out of stock`,
        body: `${pr.seed.name} has hit zero on hand.`,
        entityType: "Product", entityId: pr.id,
        href: `/inventory?q=${encodeURIComponent(pr.sku)}`,
        createdAt: daysAgo(int(1, 6)),
      });
      notifCount++;
    } else if (pr.quantity <= pr.seed.reorderPoint) {
      await notif({
        type: "LOW_STOCK",
        title: `${pr.sku} fell below its reorder point`,
        body: `${pr.seed.name} is at ${pr.quantity} on hand (reorder point ${pr.seed.reorderPoint}).`,
        entityType: "Product", entityId: pr.id,
        href: `/inventory?q=${encodeURIComponent(pr.sku)}`,
        createdAt: daysAgo(int(1, 8)),
      });
      notifCount++;
    }
  }
  // A recovered SKU: raised back above its reorder point by the PWR PO.
  const gan = bySku("PWR-001");
  await notif({
    type: "LOW_STOCK",
    title: "PWR-001 fell below its reorder point",
    body: `${gan.seed.name} dipped low before the last delivery.`,
    entityType: "Product", entityId: gan.id,
    href: "/inventory?q=PWR-001",
    createdAt: daysAgo(8),
    resolvedAt: daysAgo(5),
  });
  const poReceivedNotif = await notif({
    type: "PO_RECEIVED",
    title: "PO-2026-0402 received",
    body: "2 lines, +580 units into stock.",
    entityType: "PurchaseOrder", entityId: lastReceivedPoId,
    href: "/purchase-orders",
    createdAt: daysAgo(5),
  });
  notifCount += 2;
  // The demo user has already seen the receipt; the rest stay unread so the
  // bell lights up on first login.
  await prisma.notificationRead.create({ data: { notificationId: poReceivedNotif.id, userId: demo.id, readAt: daysAgo(4) } });

  const low = products.filter((x) => x.quantity > 0 && x.quantity <= x.seed.reorderPoint).length;
  const outOfStock = products.filter((x) => x.quantity === 0).length;
  console.log(
    `Seeded: ${products.length} SKUs, ${SUPPLIERS.length} suppliers, 3 warehouses, ${moveCount} movements, ` +
      `${lotCount} lots, ${CUSTOMERS.length} customers, ${soCount} sales orders, 4 POs, ` +
      `${auditRows.length} audit entries, ${notifCount} notifications.`
  );
  console.log(`Stories: ${outOfStock} stocked out, ${low} low, 1 SO that can't fulfill from EAST, 1 lot expiring soon, 1 expired lot.`);
  console.log("Logins (all demo1234): demo@stockpilot.app (admin) · purchasing@stockpilot.app · viewer@stockpilot.app");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
