import { PrismaClient, MovementType, PoStatus } from "@prisma/client";
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

// velocity = typical units sold per day. Profiles create the stories the
// dashboard and advisor need: fast movers, steady movers, and dead stock.
type SeedProduct = {
  sku: string; name: string; category: string; unitCost: number; price: number;
  supplier: number; velocity: number; startQty: number; reorderPoint: number; reorderQty: number;
};

const PRODUCTS: SeedProduct[] = [
  { sku: "AUD-001", name: "Studio Monitor Headphones", category: "Audio", unitCost: 48, price: 119, supplier: 2, velocity: 3.2, startQty: 420, reorderPoint: 80, reorderQty: 200 },
  { sku: "AUD-002", name: "True Wireless Earbuds Pro", category: "Audio", unitCost: 26, price: 79, supplier: 2, velocity: 6.5, startQty: 700, reorderPoint: 150, reorderQty: 400 },
  { sku: "AUD-003", name: "USB Condenser Microphone", category: "Audio", unitCost: 31, price: 89, supplier: 2, velocity: 1.8, startQty: 220, reorderPoint: 50, reorderQty: 120 },
  { sku: "AUD-004", name: "Bluetooth Party Speaker XL", category: "Audio", unitCost: 62, price: 159, supplier: 2, velocity: 1.1, startQty: 140, reorderPoint: 30, reorderQty: 80 },
  { sku: "COM-001", name: "Mechanical Keyboard TKL", category: "Computing", unitCost: 38, price: 99, supplier: 5, velocity: 4.1, startQty: 500, reorderPoint: 100, reorderQty: 250 },
  { sku: "COM-002", name: "Wireless Ergonomic Mouse", category: "Computing", unitCost: 14, price: 39, supplier: 5, velocity: 5.8, startQty: 640, reorderPoint: 140, reorderQty: 350 },
  { sku: "COM-003", name: "1080p Streaming Webcam", category: "Computing", unitCost: 19, price: 55, supplier: 5, velocity: 2.4, startQty: 260, reorderPoint: 60, reorderQty: 150 },
  { sku: "COM-004", name: "Laptop Stand Aluminium", category: "Computing", unitCost: 12, price: 34, supplier: 5, velocity: 2.9, startQty: 320, reorderPoint: 70, reorderQty: 180 },
  { sku: "COM-005", name: "27\" QHD IPS Monitor", category: "Computing", unitCost: 118, price: 249, supplier: 0, velocity: 1.6, startQty: 190, reorderPoint: 45, reorderQty: 100 },
  { sku: "CAB-001", name: "USB-C to HDMI Cable 2m", category: "Cables & Adapters", unitCost: 4.2, price: 15, supplier: 3, velocity: 8.4, startQty: 900, reorderPoint: 220, reorderQty: 500 },
  { sku: "CAB-002", name: "USB-C Hub 7-in-1", category: "Cables & Adapters", unitCost: 13, price: 42, supplier: 3, velocity: 4.6, startQty: 480, reorderPoint: 110, reorderQty: 260 },
  { sku: "CAB-003", name: "Braided Lightning Cable 1m", category: "Cables & Adapters", unitCost: 2.8, price: 12, supplier: 3, velocity: 7.2, startQty: 760, reorderPoint: 190, reorderQty: 450 },
  { sku: "CAB-004", name: "Ethernet Cat-6 Cable 5m", category: "Cables & Adapters", unitCost: 3.1, price: 11, supplier: 3, velocity: 3.4, startQty: 380, reorderPoint: 90, reorderQty: 220 },
  { sku: "SMH-001", name: "Smart Plug (2-pack)", category: "Smart Home", unitCost: 9, price: 27, supplier: 0, velocity: 3.8, startQty: 420, reorderPoint: 95, reorderQty: 240 },
  { sku: "SMH-002", name: "Wi-Fi Video Doorbell", category: "Smart Home", unitCost: 34, price: 95, supplier: 0, velocity: 1.9, startQty: 210, reorderPoint: 50, reorderQty: 120 },
  { sku: "SMH-003", name: "Smart LED Bulb E27 RGBW", category: "Smart Home", unitCost: 5.5, price: 19, supplier: 0, velocity: 5.1, startQty: 540, reorderPoint: 130, reorderQty: 300 },
  { sku: "SMH-004", name: "Zigbee Motion Sensor", category: "Smart Home", unitCost: 8, price: 25, supplier: 0, velocity: 1.4, startQty: 160, reorderPoint: 40, reorderQty: 100 },
  { sku: "PWR-001", name: "65W GaN Charger", category: "Power", unitCost: 11, price: 36, supplier: 4, velocity: 5.4, startQty: 580, reorderPoint: 130, reorderQty: 320 },
  { sku: "PWR-002", name: "20,000mAh Power Bank", category: "Power", unitCost: 16, price: 49, supplier: 4, velocity: 4.2, startQty: 460, reorderPoint: 105, reorderQty: 260 },
  { sku: "PWR-003", name: "Wireless Charging Pad 15W", category: "Power", unitCost: 8.5, price: 29, supplier: 4, velocity: 2.6, startQty: 300, reorderPoint: 65, reorderQty: 170 },
  { sku: "PWR-004", name: "UPS 850VA Line-Interactive", category: "Power", unitCost: 58, price: 139, supplier: 4, velocity: 0.9, startQty: 120, reorderPoint: 25, reorderQty: 60 },
  { sku: "ACC-001", name: "Adjustable Phone Tripod", category: "Accessories", unitCost: 7, price: 24, supplier: 1, velocity: 2.2, startQty: 250, reorderPoint: 60, reorderQty: 140 },
  { sku: "ACC-002", name: "Laptop Sleeve 14\" Felt", category: "Accessories", unitCost: 6, price: 22, supplier: 1, velocity: 1.7, startQty: 200, reorderPoint: 45, reorderQty: 110 },
  { sku: "ACC-003", name: "Cable Management Kit", category: "Accessories", unitCost: 3.5, price: 14, supplier: 1, velocity: 3.1, startQty: 340, reorderPoint: 80, reorderQty: 200 },
  { sku: "ACC-004", name: "Screen Cleaning Kit Pro", category: "Accessories", unitCost: 2.2, price: 9, supplier: 1, velocity: 2.8, startQty: 310, reorderPoint: 75, reorderQty: 180 },
  // Engineered stories ↓
  { sku: "COM-006", name: "4K Capture Card", category: "Computing", unitCost: 52, price: 129, supplier: 5, velocity: 2.1, startQty: 96, reorderPoint: 55, reorderQty: 130 }, // critical: runs out during lead time
  { sku: "AUD-005", name: "Vinyl Turntable Classic", category: "Audio", unitCost: 74, price: 189, supplier: 2, velocity: 0.08, startQty: 64, reorderPoint: 10, reorderQty: 30 }, // dead stock
  { sku: "SMH-005", name: "Smart IR Remote Hub", category: "Smart Home", unitCost: 12, price: 35, supplier: 0, velocity: 0.05, startQty: 88, reorderPoint: 15, reorderQty: 50 }, // dead stock
  { sku: "PWR-005", name: "Solar Camping Charger", category: "Power", unitCost: 21, price: 59, supplier: 4, velocity: 1.3, startQty: 42, reorderPoint: 35, reorderQty: 90 }, // low, reorder soon
  { sku: "CAB-005", name: "Thunderbolt 4 Cable 1m", category: "Cables & Adapters", unitCost: 15, price: 45, supplier: 3, velocity: 1.9, startQty: 28, reorderPoint: 40, reorderQty: 110 }, // below reorder point now
];

const OUT_REASONS = ["Online order", "Retail order", "B2B order", "Marketplace order"];
const ADJ_REASONS = ["Cycle count correction", "Damaged in warehouse", "Customer return restock", "Shrinkage write-off"];

async function main() {
  console.log("Seeding StockPilot…");

  await prisma.reorderSuggestion.deleteMany();
  await prisma.advisorRun.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: "demo@stockpilot.app",
      name: "Demo Operator",
      password: await bcrypt.hash("demo1234", 10),
    },
  });

  const suppliers = [];
  for (const s of SUPPLIERS) suppliers.push(await prisma.supplier.create({ data: s }));

  let moveCount = 0;
  const products: Array<{ id: string; sku: string; supplierId: string; unitCost: number; quantity: number; seed: SeedProduct }> = [];

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
        supplierId: suppliers[p.supplier].id,
      },
    });

    // Replay 90 days: opening balance, daily sales, scheduled replenishment
    // cycles (warehouses order ahead — INs land periodically, not only in a
    // crisis), and occasional adjustments.
    const rows: { type: MovementType; quantity: number; balance: number; reason: string; reference: string | null; occurredAt: Date }[] = [];
    let bal = p.startQty;
    rows.push({ type: "IN", quantity: p.startQty, balance: bal, reason: "Opening balance", reference: null, occurredAt: daysAgo(90, 8) });

    const engineered = ["COM-006", "PWR-005", "CAB-005", "AUD-005", "SMH-005"].includes(p.sku);
    const restockDays = new Set<number>();
    if (!engineered && p.velocity >= 1.5) {
      const cycles = Math.max(1, Math.min(3, Math.floor((p.velocity * 90) / p.reorderQty)));
      // Random days per product so arrivals spread across the quarter instead
      // of clustering into one synchronized delivery week.
      for (let i = 1; i <= cycles; i++) {
        restockDays.add(int(10, 80));
      }
    }

    for (let d = 89; d >= 0; d--) {
      // Sales: Poisson-ish around the velocity, weekends slower.
      const date = daysAgo(d, int(9, 18));
      const weekday = date.getUTCDay();
      const mult = weekday === 0 || weekday === 6 ? 0.55 : 1;
      let sold = Math.round(p.velocity * mult * between(0.4, 1.7));
      if (sold > 0) {
        sold = Math.min(sold, bal);
        if (sold > 0) {
          bal -= sold;
          rows.push({ type: "OUT", quantity: sold, balance: bal, reason: pick(OUT_REASONS), reference: `SO-${int(10000, 99999)}`, occurredAt: date });
        }
      }
      // Scheduled replenishment cycle, plus an emergency top-up if a SKU
      // dips below its reorder point mid-window.
      if (restockDays.has(d) || (!engineered && d > 12 && bal < p.reorderPoint && rand() < 0.5)) {
        const qty = p.reorderQty;
        bal += qty;
        rows.push({ type: "IN", quantity: qty, balance: bal, reason: "PO received", reference: `PO-2026-0${int(100, 399)}`, occurredAt: daysAgo(d, 9) });
        restockDays.delete(d);
      }
      // Rare adjustment.
      if (rand() < 0.012) {
        const delta = pick([-3, -2, -1, 1, 2]);
        if (bal + delta >= 0) {
          bal += delta;
          rows.push({ type: "ADJUST", quantity: delta, balance: bal, reason: pick(ADJ_REASONS), reference: null, occurredAt: daysAgo(d, 19) });
        }
      }
    }

    await prisma.stockMovement.createMany({ data: rows.map((r) => ({ ...r, productId: product.id })) });
    moveCount += rows.length;
    await prisma.product.update({ where: { id: product.id }, data: { quantity: bal } });
    products.push({ ...product, quantity: bal, seed: p });
  }

  // Purchase orders: received history + open orders for the low-stock SKUs.
  const bySku = (sku: string) => products.find((x) => x.sku === sku)!;
  let poSeq = 401;
  const mkNumber = () => `PO-2026-0${poSeq++}`;

  // Two received historical POs.
  for (const group of [
    { supplier: 3, items: ["CAB-001", "CAB-002", "CAB-003"], daysOrdered: 34, daysReceived: 26 },
    { supplier: 4, items: ["PWR-001", "PWR-002"], daysOrdered: 21, daysReceived: 5 },
  ]) {
    await prisma.purchaseOrder.create({
      data: {
        number: mkNumber(),
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
  }

  // One ORDERED (in transit) for the critical capture card.
  const cc = bySku("COM-006");
  await prisma.purchaseOrder.create({
    data: {
      number: mkNumber(),
      status: "ORDERED",
      supplierId: cc.supplierId,
      createdAt: daysAgo(6),
      orderedAt: daysAgo(5),
      expectedAt: daysAgo(-6), // due in 6 days
      items: { create: [{ productId: cc.id, quantity: cc.seed.reorderQty, unitCost: cc.unitCost }] },
    },
  });

  // One DRAFT with the two other low SKUs.
  const draftItems = ["CAB-005", "PWR-005"].map((sku) => {
    const pr = bySku(sku);
    return { productId: pr.id, quantity: pr.seed.reorderQty, unitCost: pr.unitCost };
  });
  await prisma.purchaseOrder.create({
    data: {
      number: mkNumber(),
      status: "DRAFT",
      supplierId: suppliers[3].id,
      createdAt: daysAgo(1),
      items: { create: draftItems },
    },
  });

  const low = products.filter((x) => x.quantity <= (x.seed.reorderPoint ?? 0)).length;
  console.log(`Seeded: ${products.length} SKUs, ${SUPPLIERS.length} suppliers, ${moveCount} movements, 4 POs. Low-stock now: ${low}.`);
  console.log("Login: demo@stockpilot.app / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
