import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { getProducts, type ProductRow } from "./inventory";

// The Claude model used for the reorder advisor. Override with ADVISOR_MODEL.
const MODEL = process.env.ADVISOR_MODEL || "claude-sonnet-5";

// The Gemini model used when GEMINI_API_KEY is set (free tier via Google AI
// Studio). "gemini-flash-latest" always points at the current free flash model.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Free-tier daily quotas are counted PER MODEL, so each entry below is a
// separate quota bucket. When the preferred model is exhausted (429) or
// unavailable (404/503), geminiPlan retries the same request on the next one
// before falling through to the heuristic planner.
const GEMINI_MODELS = [
  ...new Set([
    GEMINI_MODEL,
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
  ]),
];

type Urgency = "CRITICAL" | "SOON" | "OK" | "DEAD";

export interface Suggestion {
  productName: string;
  sku: string;
  urgency: Urgency;
  suggestedQty: number;
  daysOfCover: number;
  rationale: string;
}

export interface AdvisorPayload {
  summary: string;
  suggestions: Suggestion[];
  source: "AI" | "HEURISTIC";
}

const DEAD_AFTER_DAYS = 45;

// Signals the planner reasons over, derived per SKU.
function features(p: ProductRow) {
  const daysOfCover = p.velocity30d > 0 ? p.quantity / p.velocity30d : Infinity;
  const daysSinceLastSale = p.lastOutAt
    ? Math.floor((Date.now() - new Date(p.lastOutAt).getTime()) / 86_400_000)
    : Infinity;
  return { daysOfCover, daysSinceLastSale };
}

// --- Heuristic planner (fallback, no API key needed) -------------------------
// Cover the lead time plus a 30-day buffer; flag dead stock instead of
// reordering it; net suggested quantities against stock already in transit.
// Transparent enough to walk through in an interview.
export function heuristicPlan(products: ProductRow[], inbound: Map<string, number>): AdvisorPayload {
  const suggestions: Suggestion[] = [];

  for (const p of products) {
    const { daysOfCover, daysSinceLastSale } = features(p);
    const inboundQty = inbound.get(p.id) ?? 0;

    // Stocked out with recent demand. Velocity reads 0 once the shelf is
    // empty (nothing to sell), so this can't fall through to the cover math.
    if (p.quantity === 0 && daysSinceLastSale <= 60) {
      const rate = Math.max(p.velocity30d, 0.5);
      const need = Math.max(p.reorderQty, Math.ceil(rate * (p.leadTimeDays + 30)));
      const qty = need - inboundQty;
      if (qty <= 0) {
        suggestions.push({
          productName: p.name,
          sku: p.sku,
          urgency: "SOON",
          suggestedQty: 0,
          daysOfCover: 0,
          rationale: `Out of stock, but ${inboundQty} units are already in transit — chase that PO in, don't order more yet.`,
        });
      } else {
        suggestions.push({
          productName: p.name,
          sku: p.sku,
          urgency: "CRITICAL",
          suggestedQty: qty,
          daysOfCover: 0,
          rationale: `Stocked out with demand as recent as ${daysSinceLastSale} day${daysSinceLastSale === 1 ? "" : "s"} ago — every day is lost sales. ${inboundQty > 0 ? `${inboundQty} inbound helps but falls short; order` : "Order"} ${qty} now (${p.supplierName} needs ${p.leadTimeDays} days).`,
        });
      }
      continue;
    }

    if (p.velocity30d === 0 && p.quantity > 0 && daysSinceLastSale > DEAD_AFTER_DAYS) {
      suggestions.push({
        productName: p.name,
        sku: p.sku,
        urgency: "DEAD",
        suggestedQty: 0,
        daysOfCover: 999,
        rationale: `No sales in ${daysSinceLastSale === Infinity ? "90+" : daysSinceLastSale} days with ${p.quantity} units on hand (${formatMoneyLocal(p.quantity * p.unitCost)} tied up). Don't reorder — consider clearance or bundling.`,
      });
      continue;
    }
    if (p.velocity30d === 0) continue;

    const target = Math.ceil(p.velocity30d * (p.leadTimeDays + 30)); // cover lead time + 30d
    const gap = Math.max(0, target - p.quantity - inboundQty);
    const qty = gap > 0 ? Math.max(p.reorderQty, gap) : 0;

    let urgency: Urgency = "OK";
    if (daysOfCover <= p.leadTimeDays) urgency = "CRITICAL";
    else if (daysOfCover <= p.leadTimeDays + 10) urgency = "SOON";

    if (urgency !== "OK") {
      suggestions.push({
        productName: p.name,
        sku: p.sku,
        urgency,
        suggestedQty: qty,
        daysOfCover: Math.round(daysOfCover * 10) / 10,
        rationale:
          urgency === "CRITICAL"
            ? `Selling ${p.velocity30d}/day, only ${p.quantity} on hand — ~${Math.floor(daysOfCover)} days of cover, but ${p.supplierName} needs ${p.leadTimeDays} days to deliver. Order ${qty} now to avoid a stockout.`
            : `${Math.floor(daysOfCover)} days of cover vs a ${p.leadTimeDays}-day lead time. Order ${qty} within the week to stay ahead of demand.`,
      });
    }
  }

  const order: Urgency[] = ["CRITICAL", "SOON", "DEAD", "OK"];
  suggestions.sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));

  const critical = suggestions.filter((s) => s.urgency === "CRITICAL").length;
  const soon = suggestions.filter((s) => s.urgency === "SOON").length;
  const dead = suggestions.filter((s) => s.urgency === "DEAD").length;

  return {
    summary: `Scanned ${products.length} SKUs against 30-day sales velocity and supplier lead times. ${critical} SKU${critical === 1 ? "" : "s"} will stock out before a replenishment order could arrive, ${soon} need${soon === 1 ? "s" : ""} an order this week, and ${dead} ${dead === 1 ? "is" : "are"} dead stock tying up cash. Suggested quantities cover the supplier lead time plus a 30-day buffer.`,
    suggestions,
    source: "HEURISTIC",
  };
}

function formatMoneyLocal(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// The instruction + per-SKU signal table both planners reason over. Kept in one
// place so Claude and Gemini receive byte-for-byte identical input.
function advisorPrompt(products: ProductRow[], inbound: Map<string, number>): string {
  const lines = products.map((p) => {
    const { daysOfCover, daysSinceLastSale } = features(p);
    return `${p.sku} ${p.name} | on-hand ${p.quantity} | inbound on open POs ${inbound.get(p.id) ?? 0} | sells ${p.velocity30d}/day (30d) | cover ${daysOfCover === Infinity ? "inf" : Math.round(daysOfCover)}d | reorder point ${p.reorderPoint} | default order ${p.reorderQty} | lead time ${p.leadTimeDays}d (${p.supplierName}) | last sale ${daysSinceLastSale === Infinity ? "never" : `${daysSinceLastSale}d ago`} | unit cost $${p.unitCost}`;
  });
  return `You are the replenishment planner for StockPilot, an electronics distributor's warehouse. For each SKU below decide urgency: CRITICAL (stocked out with recent demand, or will stock out before the lead time), SOON (order this week, or stocked out but the inbound PO already covers it), DEAD (no demand ≥ ${DEAD_AFTER_DAYS} days with stock on hand — suggest 0 and a clearance note), otherwise OK. Only include CRITICAL, SOON, and DEAD SKUs in suggestions (skip OK). Suggested quantities should cover lead time plus ~30 days of demand, minus units already inbound on open POs, at least the default order size when ordering.

${lines.join("\n")}`;
}

// --- Claude-powered planner ---------------------------------------------------
async function aiPlan(products: ProductRow[], inbound: Map<string, number>): Promise<AdvisorPayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      tools: [
        {
          name: "report_reorder_plan",
          description: "Report the replenishment plan for the warehouse.",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "3-4 sentence summary of the inventory position and what to do first." },
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sku: { type: "string" },
                    productName: { type: "string" },
                    urgency: { type: "string", enum: ["CRITICAL", "SOON", "OK", "DEAD"] },
                    suggestedQty: { type: "integer", description: "Units to order now (0 for DEAD/OK)." },
                    daysOfCover: { type: "number", description: "Days of stock left at current velocity (999 if no demand)." },
                    rationale: { type: "string", description: "1-2 sentences citing the actual numbers." },
                  },
                  required: ["sku", "productName", "urgency", "suggestedQty", "daysOfCover", "rationale"],
                },
              },
            },
            required: ["summary", "suggestions"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "report_reorder_plan" },
      messages: [{ role: "user", content: advisorPrompt(products, inbound) }],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      const input = toolUse.input as { summary: string; suggestions: Suggestion[] };
      const order: Urgency[] = ["CRITICAL", "SOON", "DEAD", "OK"];
      const suggestions = [...input.suggestions].sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));
      return { summary: input.summary, suggestions, source: "AI" };
    }
    return null;
  } catch (err) {
    console.error("Claude advisor failed, using heuristic:", err);
    return null;
  }
}

// --- Gemini-powered planner (free tier via Google AI Studio) ------------------
// Uses the REST API directly so no extra npm dependency is required. Get a free
// key (no credit card) at https://aistudio.google.com/apikey.
async function geminiPlan(products: ProductRow[], inbound: Map<string, number>): Promise<AdvisorPayload | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Force structured JSON mirroring AdvisorPayload. Gemini's responseSchema is a
  // subset of OpenAPI (type/properties/required/items/enum).
  const responseSchema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sku: { type: "string" },
            productName: { type: "string" },
            urgency: { type: "string", enum: ["CRITICAL", "SOON", "OK", "DEAD"] },
            suggestedQty: { type: "integer" },
            daysOfCover: { type: "number" },
            rationale: { type: "string" },
          },
          required: ["sku", "productName", "urgency", "suggestedQty", "daysOfCover", "rationale"],
        },
      },
    },
    required: ["summary", "suggestions"],
  };

  // The "flash-latest" alias now resolves to a thinking model (gemini-3.5-flash)
  // that spends its output budget reasoning before emitting text — on a
  // non-streaming call that both delays the response and can return empty
  // content. thinkingBudget:0 disables that so we get the JSON directly and fast.
  // The AbortController caps the wait: a slow or unreachable API aborts here and
  // falls back to the heuristic planner in seconds, instead of hanging until
  // undici's 5-minute headers timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    // Quota errors are per model — walk the fallback chain (within the single
    // 45s budget) before giving up to the heuristic.
    let res: Response | null = null;
    for (const candidate of GEMINI_MODELS) {
      const attempt = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: advisorPrompt(products, inbound) }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );
      if (attempt.ok) {
        res = attempt;
        break;
      }
      console.error(`Gemini advisor failed (${candidate}):`, attempt.status, await attempt.text());
      if (![429, 404, 503].includes(attempt.status)) return null;
    }
    if (!res) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as { summary: string; suggestions: Suggestion[] };
    if (!parsed.summary || !Array.isArray(parsed.suggestions)) return null;
    const order: Urgency[] = ["CRITICAL", "SOON", "DEAD", "OK"];
    const suggestions = [...parsed.suggestions].sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));
    return { summary: parsed.summary, suggestions, source: "AI" };
  } catch (err) {
    console.error("Gemini advisor failed, using fallback:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Run the planner, persist the run, return it with suggestions.
export async function generateAndSavePlan() {
  const products = await getProducts();
  // Stock already committed on in-transit POs — the planner nets against it.
  const openItems = await prisma.purchaseOrderItem.groupBy({
    by: ["productId"],
    where: { po: { status: "ORDERED" } },
    _sum: { quantity: true },
  });
  const inbound = new Map(openItems.map((i) => [i.productId, i._sum.quantity ?? 0]));
  const payload =
    (await aiPlan(products, inbound)) ?? (await geminiPlan(products, inbound)) ?? heuristicPlan(products, inbound);

  return prisma.advisorRun.create({
    data: {
      summary: payload.summary,
      source: payload.source,
      suggestions: {
        create: payload.suggestions.map((s) => ({
          productName: s.productName,
          sku: s.sku,
          urgency: s.urgency,
          suggestedQty: s.suggestedQty,
          daysOfCover: s.daysOfCover,
          rationale: s.rationale,
        })),
      },
    },
    include: { suggestions: true },
  });
}

export async function getLatestRun() {
  return prisma.advisorRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: { suggestions: true },
  });
}
