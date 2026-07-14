# 🏗️ StockPilot — Architecture

The one idea everything is built on: **stock is a ledger, not a number.**
On-hand quantity is *derived* from an append-only movement history — never
typed into a box — so the books can't silently drift.

---

## 1. The big picture

StockPilot is a single **Next.js 16 (App Router)** application — the API route
handlers *are* the backend. Nothing touches the database or the AI except code
in `src/lib/`. State lives in **PostgreSQL** through **Prisma**.

```mermaid
flowchart LR
  subgraph Client["🖥️ Client (React 19)"]
    V["Views: Dashboard · Inventory · Movements<br/>Purchase Orders · Suppliers · Advisor"]
  end
  subgraph Server["⚙️ Next.js route handlers"]
    API["/api: products · movements<br/>purchase-orders · advisor · auth"]
    LIB["src/lib: inventory · advisor"]
    API --> LIB
  end
  PG[("🐘 PostgreSQL via Prisma")]
  ADV["Claude / Gemini<br/>(reorder advisor)"]
  V -- "server components + fetch" --> API
  LIB -- "SELECT FOR UPDATE + transactions" --> PG
  LIB -- "velocity + cover + lead time" --> ADV
```

---

## 2. The core rule — on-hand is derived from the ledger

`Product.quantity` exists, but it is **only ever mutated inside a transaction**
that also writes a `StockMovement`. The UI deliberately makes on-hand
**non-editable** — the only ways stock changes are:

1. **Recording a movement** — `IN` (receipt), `OUT` (sale/issue), or a signed
   `ADJUST` (cycle count / shrinkage).
2. **Receiving a purchase order** — which writes `IN` movements.

```mermaid
sequenceDiagram
  participant U as Operator
  participant API as /api/movements
  participant DB as PostgreSQL

  U->>API: record OUT 11 units of AUD-002
  API->>DB: BEGIN then SELECT ... FOR UPDATE (product row)
  Note over DB: row locked, concurrent writes queue
  API->>DB: check on-hand covers the OUT (else 409)
  API->>DB: UPDATE quantity + INSERT StockMovement (balance snapshot)
  API->>DB: COMMIT (lock released)
  API-->>U: 201 with new running balance
```

Each movement **snapshots the resulting balance**, so the full history is
auditable without replaying every row. An `OUT` that would drive stock negative
is rejected with a **409** — you can't oversell the ledger.

---

## 3. Purchase orders — a guarded status machine

```
DRAFT ──▶ ORDERED ──▶ RECEIVED
   └────────▶ CANCELLED
```

Receiving a PO is **atomic**: in one Prisma transaction it increments each SKU's
stock *and* writes the matching `IN` movements, so the ledger and on-hand can
never disagree. "Prefill low-stock SKUs" builds a draft order in one click, and
a SKU can't be deleted while it sits on a draft/ordered PO.

---

## 4. The AI Reorder Advisor

The advisor turns the raw ledger into a **ranked replenishment plan**. For each
SKU it computes deterministic signals — 30-day sales **velocity**, **days of
cover** at that velocity, supplier **lead time**, and stock already **inbound**
on open POs — then asks Claude to classify and explain:

| Urgency | Meaning |
|---------|---------|
| `CRITICAL` | Will stock out before a new order can arrive |
| `SOON` | Stockout likely shortly after the lead time |
| `OK` | Healthy cover |
| `DEAD` | No demand — don't reorder, consider clearance |

Provider order: **Claude → Gemini → a transparent heuristic planner**, so the
advisor always returns a result (and every run is stored as an `AdvisorRun` with
its `ReorderSuggestion`s and the source that produced it).

---

## 5. Data model (`prisma/schema.prisma`)

| Model | Purpose |
|-------|---------|
| `User` | Operator account (bcrypt password hash). |
| `Supplier` | Directory with `leadTimeDays` — which drives the advisor's urgency math. |
| `Product` | A SKU: cost, price, `quantity` (derived), `reorderPoint`, `reorderQty`. |
| `StockMovement` | **The append-only ledger** — `type` (IN/OUT/ADJUST), qty, `balance` snapshot, reason, reference. |
| `PurchaseOrder` + `PurchaseOrderItem` | Draft→ordered→received status machine; receiving writes IN movements. |
| `AdvisorRun` + `ReorderSuggestion` | A stored advisor run with per-SKU urgency, suggested qty, days-of-cover and rationale. |

**Enums** — `MovementType` (IN/OUT/ADJUST) · `PoStatus` (DRAFT/ORDERED/RECEIVED/CANCELLED) · `Urgency` (CRITICAL/SOON/OK/DEAD) · `AdvisorSource` (AI/HEURISTIC).

---

## 6. Project layout

```
src/
├── app/
│   ├── api/
│   │   ├── products/route.ts · products/[id]/route.ts
│   │   ├── movements/route.ts               # ledger writes (SELECT … FOR UPDATE)
│   │   ├── purchase-orders/route.ts · [id]/route.ts   # status machine + receiving
│   │   ├── advisor/route.ts                 # run the reorder advisor
│   │   ├── register/route.ts · auth/[...nextauth]/route.ts
│   ├── dashboard · inventory · movements · purchase-orders · suppliers · advisor  # pages
│   ├── login · signup · page.tsx (landing) · layout.tsx
├── components/
│   ├── dashboard/ · inventory/ · movements/ · purchase-orders/ · advisor/  # per-view UIs
│   ├── charts/chartKit.tsx  · Badges.tsx · Shell.tsx · Logo.tsx · Providers.tsx
└── lib/
    ├── inventory.ts   # the hot path: ledger writes + PO receiving (transactions)
    ├── advisor.ts     # velocity/cover math + Claude/Gemini/heuristic planner
    ├── auth.ts · session.ts · prisma.ts · utils.ts
```

> `src/lib/` is the hub every part routes through — nothing touches the database
> or the AI except code in `lib`.

---

## 7. Auth

Email/password via **next-auth** (credentials, JWT sessions, bcrypt-hashed
passwords). Every page and API route requires a valid session; the login screen
pre-fills the demo operator so the app is one click from the warehouse.
