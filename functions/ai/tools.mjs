// AI tools. Every tool queries only real, tenant-scoped data and returns exactly
// what exists. The orchestrator and the LLM are forbidden from inventing values;
// when a tool finds nothing it says so, and the assistant must escalate.
import { appError } from "../db.mjs";

export const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "₵", KES: "KSh" };

export function formatMoney(minor, currency = "NGN") {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const value = Number.isFinite(minor) ? minor / 100 : 0;
  return `${symbol}${value.toLocaleString("en-NG", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

async function q(supabase, builder) {
  const { data, error } = await builder;
  if (error) throw appError("db_error", 503);
  return data || [];
}

export async function getBusinessInformation(supabase, businessId) {
  const rows = await q(supabase, supabase.from("businesses").select("*").eq("id", businessId).maybeSingle());
  const b = rows || null;
  if (!b) return { found: false };
  return {
    found: true,
    name: b.name, business_type: b.business_type, description: b.description,
    location: b.location, phone: b.phone, email: b.email, website: b.website,
    social_links: b.social_links || {}, currency: b.currency || "NGN",
  };
}

export async function getBusinessHours(supabase, businessId) {
  const rows = await q(supabase, supabase.from("business_hours").select("day,is_open,open_time,close_time").eq("business_id", businessId));
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const map = {};
  for (const r of rows) map[r.day] = r;
  return order.map((day) => ({ day, ...(map[day] || { is_open: false, open_time: null, close_time: null }) }));
}

export async function getPolicies(supabase, businessId, kind) {
  let builder = supabase.from("policies").select("kind,body").eq("business_id", businessId);
  if (kind) builder = builder.eq("kind", kind);
  return q(supabase, builder);
}

export async function getDeliveryInformation(supabase, businessId) {
  const rows = await getPolicies(supabase, businessId, "delivery");
  return rows.length ? rows[0].body : null;
}

export async function getFaqs(supabase, businessId) {
  return q(supabase, supabase.from("faqs").select("question,answer").eq("business_id", businessId));
}

// Intent/conversational words that must never drive a product match, plus a
// minimum confidence so weak substring hits ("unisex" contains "is") are ignored.
const STOPWORDS = new Set(["is", "the", "and", "for", "you", "your", "how", "much", "many", "what", "which", "price", "prices", "cost", "please", "hello", "hey", "are", "was", "were", "can", "could", "would", "want", "need", "like", "about", "there", "their", "them", "get", "got", "any", "some", "with", "from", "buy", "order", "purchase", "available", "availability", "stock", "have", "has", "this", "that", "with", "naira", "₦"]);

export function tokenize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

const MIN_SCORE = 3;

export async function searchProducts(supabase, businessId, query, limit = 8) {
  const rows = await q(supabase, supabase.from("products").select("id,name,description,price,currency,category,stock_status,sku").eq("business_id", businessId));
  const tokens = tokenize(query);
  if (!tokens.length) return rows.slice(0, limit);
  const scored = rows.map((p) => {
    const name = (p.name || "").toLowerCase();
    const hay = `${p.name} ${p.description || ""} ${p.category || ""} ${p.sku || ""}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (name.includes(t)) score += 5;
      else if (hay.includes(t)) score += 2;
    }
    return { p, score };
  }).filter((x) => x.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

export async function getProductDetails(supabase, businessId, nameOrId) {
  const needle = String(nameOrId || "").toLowerCase().trim();
  const rows = await q(supabase, supabase.from("products").select("*").eq("business_id", businessId));
  const exact = rows.find((p) => p.name.toLowerCase() === needle);
  const partial = rows.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()));
  const match = exact || partial;
  if (!match) return { found: false };
  return { found: true, product: match };
}

export async function checkAvailability(supabase, businessId, nameOrId) {
  const details = await getProductDetails(supabase, businessId, nameOrId);
  if (!details.found) return { found: false };
  return { found: true, name: details.product.name, stock_status: details.product.stock_status };
}

export async function getServices(supabase, businessId, query) {
  const rows = await q(supabase, supabase.from("services").select("id,name,description,price,currency,duration_minutes,availability").eq("business_id", businessId));
  if (!query) return rows;
  const needle = String(query).toLowerCase();
  return rows.filter((s) => `${s.name} ${s.description || ""}`.toLowerCase().includes(needle));
}

export async function createLead(supabase, businessId, lead) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id, business_id: businessId, customer_id: lead.customer_id || null,
    name: lead.name || null, phone: lead.phone || null, email: lead.email || null,
    interest: lead.interest || null, product: lead.product || null,
    source: lead.source || "whatsapp", status: "new", notes: lead.notes || null,
    created_at: now, updated_at: now,
  };
  const { data, error } = await supabase.from("leads").insert(row).select("id,status").single();
  if (error) throw appError("db_error", 503);
  return data;
}

// Tool schemas exposed to an LLM provider. Descriptions reinforce grounding rules.
export const TOOL_SCHEMAS = [
  { type: "function", function: { name: "get_business_information", description: "Get the business profile: name, type, description, location, phone, email, website, socials.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "search_products", description: "Search the real product catalog. Returns only products that exist; never invent products or prices.", parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_product_details", description: "Get full details (including exact price) for one product by name or id.", parameters: { type: "object", properties: { product: { type: "string" } }, required: ["product"], additionalProperties: false } } },
  { type: "function", function: { name: "check_availability", description: "Check the recorded stock status for a product. Never guess availability.", parameters: { type: "object", properties: { product: { type: "string" } }, required: ["product"], additionalProperties: false } } },
  { type: "function", function: { name: "get_business_hours", description: "Get opening hours for the week.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_delivery_information", description: "Get the delivery policy text. Never invent delivery times or fees.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_policies", description: "Get policies (returns, refunds, exchanges, payments, cancellations, delivery).", parameters: { type: "object", properties: { kind: { type: "string", enum: ["delivery", "returns", "refunds", "exchanges", "payments", "cancellations"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_faqs", description: "Get the business FAQs.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_services", description: "Search services offered (with price and duration).", parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "create_lead", description: "Record a sales lead when a customer shows buying intent and shares contact/interest details.", parameters: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, interest: { type: "string" }, product: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "request_human_handoff", description: "Escalate to a human when the customer asks for a person, is upset, or the answer is unknown/unavailable.", parameters: { type: "object", properties: { reason: { type: "string" } }, additionalProperties: false } } },
];

// Execute a tool call against real data. `ctx` carries supabase + businessId.
export async function executeTool(ctx, name, args = {}) {
  const { supabase, businessId } = ctx;
  switch (name) {
    case "get_business_information": return getBusinessInformation(supabase, businessId);
    case "search_products": return searchProducts(supabase, businessId, args.query);
    case "get_product_details": return getProductDetails(supabase, businessId, args.product);
    case "check_availability": return checkAvailability(supabase, businessId, args.product);
    case "get_business_hours": return getBusinessHours(supabase, businessId);
    case "get_delivery_information": return { delivery: await getDeliveryInformation(supabase, businessId) };
    case "get_policies": return getPolicies(supabase, businessId, args.kind);
    case "get_faqs": return getFaqs(supabase, businessId);
    case "get_services": return getServices(supabase, businessId, args.query);
    case "create_lead": return createLead(supabase, businessId, { ...args, source: args.source || "ai" });
    case "request_human_handoff": return { handoff_requested: true, reason: args.reason || "customer_request" };
    default: return { error: "unknown_tool" };
  }
}
