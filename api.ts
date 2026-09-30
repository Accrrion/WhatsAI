// Browser API layer. Calls the same-origin Function `/functions/v1/app?action=...`.
// If the backend is unreachable (e.g. the static publication preview, which cannot
// execute Functions), it transparently falls back to an in-memory DEMO adapter so
// the product is fully explorable. Demo mode is surfaced to the UI via onModeChange
// and must be shown to the user — it is never presented as live data.
export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number = 0) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson(url: string, init: RequestInit = {}, messages: Readonly<Record<string, string>> = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError("The request could not be completed.", "network_error");
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError("Check your site access and sign in again.", "access_denied", response.status);
  }
  if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("The site service returned an unexpected response.", "invalid_response", response.status);
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new ApiError("The site service returned invalid JSON.", "invalid_response", response.status); }
  const body = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const code = typeof body?.error === "string" ? body.error
    : (!response.ok || body?.ok === false) && typeof body?.code === "string" ? body.code
      : response.ok ? null : "request_failed";
  if (!response.ok || body?.ok === false || code) {
    const resolved = code ?? "request_failed";
    const message = Object.prototype.hasOwnProperty.call(messages, resolved) ? messages[resolved] : "The request failed.";
    throw new ApiError(message, resolved, response.status);
  }
  return data;
}

export type Mode = "unknown" | "live" | "demo";
let mode: Mode = "unknown";
const listeners = new Set<(m: Mode) => void>();
export function onModeChange(fn: (m: Mode) => void) { listeners.add(fn); fn(mode); return () => { listeners.delete(fn); }; }
export function getMode() { return mode; }
function setMode(m: Mode) { if (mode !== m) { mode = m; listeners.forEach((fn) => fn(m)); } }

const BACKEND_DOWN = new Set(["network_error", "invalid_response", "service_unavailable", "database_runtime_unavailable"]);
const isBackendDown = (e: unknown) => e instanceof ApiError && (BACKEND_DOWN.has(e.code) || e.status === 503);
const isAuth = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403 || e.code === "access_denied" || e.code === "login_required");

type Opts = { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> };

async function live(action: string, opts: Opts): Promise<any> {
  const qs = new URLSearchParams({ action, ...(opts.query || {}) });
  return requestJson(`/functions/v1/app?${qs.toString()}`, {
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: opts.body ? { "content-type": "application/json" } : undefined,
  });
}

export async function callAction<T = any>(action: string, opts: Opts = {}): Promise<T> {
  if (mode === "demo") return demo(action, opts) as T;
  try {
    const res = await live(action, opts);
    setMode("live");
    return res as T;
  } catch (e) {
    if (isAuth(e)) throw e;
    if (isBackendDown(e)) { setMode("demo"); return demo(action, opts) as T; }
    throw e;
  }
}

// ---- types (subset used by the UI) -----------------------------------------
export interface Business { id: string; name: string; business_type: string; description: string | null; location: string | null; phone: string | null; email: string | null; website: string | null; social_links: Record<string, string>; currency: string; onboarding_step: number; }
export interface Product { id: string; name: string; description: string | null; price: number | null; currency: string; category: string | null; stock_status: string; sku: string | null; image_url: string | null; }
export interface Faq { id: string; question: string; answer: string; }
export interface Hour { day: string; is_open: boolean; open_time: string | null; close_time: string | null; }
export interface Policy { kind: string; body: string | null; }
export interface AiConfig { assistant_name: string; tone: string; language: string; welcome_message: string | null; fallback_message: string | null; response_length: string; handoff_behavior: string; is_active: boolean; }
export interface Customer { id: string; name: string | null; phone: string | null; email: string | null; wa_id: string | null; }
export interface Conversation { id: string; customer_id: string; status: string; mode: string; tags: string[]; last_message: string | null; last_message_at: string; unread: number; customer: Customer | null; }
export interface Message { id: string; direction: string; sender: string; body: string; status: string | null; created_at: string; }
export interface Lead { id: string; name: string | null; phone: string | null; email: string | null; interest: string | null; product: string | null; source: string; status: string; notes: string | null; created_at: string; }
export interface Order { id: string; status: string; total: number | null; currency: string; delivery_address: string | null; payment_status: string; created_at: string; customer_id: string | null; }
export interface Bootstrap { business: Business | null; aiConfig?: AiConfig | null; whatsapp?: any; counts?: any; aiProvider?: { configured: boolean; provider: string; model: string }; }

export const api = {
  bootstrap: () => callAction<Bootstrap>("bootstrap"),
  me: () => callAction("me"),
  seed: () => callAction("seed", { method: "POST" }),
  saveBusiness: (b: Partial<Business>) => callAction("business.save", { method: "POST", body: b }),
  getHours: () => callAction<{ hours: Hour[] }>("hours.get"),
  setHours: (hours: Hour[]) => callAction("hours.set", { method: "POST", body: { hours } }),
  getPolicies: () => callAction<{ policies: Policy[] }>("policies.get"),
  savePolicies: (policies: Policy[]) => callAction("policies.save", { method: "POST", body: { policies } }),
  listProducts: () => callAction<{ items: Product[] }>("products.list"),
  createProduct: (p: any) => callAction("products.create", { method: "POST", body: p }),
  updateProduct: (p: any) => callAction("products.update", { method: "POST", body: p }),
  deleteProduct: (id: string) => callAction("products.delete", { method: "POST", query: { id } }),
  listFaqs: () => callAction<{ items: Faq[] }>("faqs.list"),
  saveFaq: (f: any) => callAction("faqs.save", { method: "POST", body: f }),
  deleteFaq: (id: string) => callAction("faqs.delete", { method: "POST", query: { id } }),
  getAiConfig: () => callAction("aiConfig.get"),
  saveAiConfig: (c: any) => callAction("aiConfig.save", { method: "POST", body: c }),
  aiTest: (message: string, history: any[] = []) => callAction("ai.test", { method: "POST", body: { message, history } }),
  getWhatsapp: () => callAction("whatsapp.get"),
  saveWhatsapp: (w: any) => callAction("whatsapp.save", { method: "POST", body: w }),
  testWhatsapp: (to: string) => callAction("whatsapp.test", { method: "POST", body: { to } }),
  listConversations: (status?: string) => callAction<{ items: Conversation[] }>("conversations.list", { query: status ? { status } : {} }),
  getConversation: (id: string) => callAction<{ conversation: Conversation; messages: Message[] }>("conversations.get", { query: { id } }),
  reply: (id: string, message: string) => callAction("conversations.reply", { method: "POST", body: { id, message } }),
  takeover: (id: string) => callAction("conversations.takeover", { method: "POST", body: { id } }),
  returnToAi: (id: string) => callAction("conversations.returnToAi", { method: "POST", body: { id } }),
  resolve: (id: string) => callAction("conversations.resolve", { method: "POST", body: { id } }),
  tagConversation: (id: string, tags: string[]) => callAction("conversations.tag", { method: "POST", body: { id, tags } }),
  addNote: (id: string, note: string) => callAction("conversations.note", { method: "POST", body: { id, note } }),
  listCustomers: () => callAction<{ items: Customer[] }>("customers.list"),
  listLeads: () => callAction<{ items: Lead[] }>("leads.list"),
  saveLead: (l: any) => callAction("leads.save", { method: "POST", body: l }),
  deleteLead: (id: string) => callAction("leads.delete", { method: "POST", query: { id } }),
  listOrders: () => callAction<{ items: Order[] }>("orders.list"),
  saveOrder: (o: any) => callAction("orders.save", { method: "POST", body: o }),
  analytics: () => callAction("analytics"),
};

// ---- DEMO adapter (in-memory; labeled, never passed off as live) -----------
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const SYM: Record<string, string> = { NGN: "₦", USD: "$" };
function demoMoney(minor: number | null, cur = "NGN") { const v = (minor || 0) / 100; return `${SYM[cur] || ""}${v.toLocaleString("en-NG")}`; }

function seedStore() {
  const business: Business = { id: "b1", name: "Paul's Fashion Store", business_type: "fashion", description: "Trendy, affordable fashion delivered nationwide.", location: "12 Adeola Odeku St, Victoria Island, Lagos", phone: "+234 802 555 0134", email: "hello@paulsfashion.example", website: "https://paulsfashion.example", social_links: { instagram: "@paulsfashion" }, currency: "NGN", onboarding_step: 11 };
  const products: Product[] = [
    { id: "p1", name: "Black Hoodie", description: "Soft cotton-blend hoodie, unisex. M–XXL.", price: 2500000, currency: "NGN", category: "Hoodies", stock_status: "in_stock", sku: "PF-HOOD-BLK", image_url: null },
    { id: "p2", name: "White Sneakers", description: "Classic low-top sneakers. 39–45.", price: 4500000, currency: "NGN", category: "Footwear", stock_status: "in_stock", sku: "PF-SNK-WHT", image_url: null },
    { id: "p3", name: "Blue Jeans", description: "Slim-fit stretch denim. 30–40 waist.", price: 3000000, currency: "NGN", category: "Jeans", stock_status: "low_stock", sku: "PF-JEAN-BLU", image_url: null },
  ];
  const faqs: Faq[] = [
    { id: "f1", question: "How do I place an order?", answer: "Send the item, your size and delivery address here. We'll confirm the total and arrange delivery." },
    { id: "f2", question: "Do you deliver outside Lagos?", answer: "Yes — nationwide. Lagos 1–2 days; other states 3–5 days." },
    { id: "f3", question: "What payment methods?", answer: "Bank transfer and payment on delivery (Lagos)." },
  ];
  const hours: Hour[] = ["monday", "tuesday", "wednesday", "thursday", "friday"].map((d): Hour => ({ day: d, is_open: true, open_time: "09:00", close_time: "18:00" }))
    .concat([{ day: "saturday", is_open: true, open_time: "10:00", close_time: "16:00" }, { day: "sunday", is_open: false, open_time: null, close_time: null }]);
  const policies: Policy[] = [
    { kind: "delivery", body: "Nationwide. Lagos 1–2 days (₦2,000); other states 3–5 days (₦3,500–₦5,000)." },
    { kind: "returns", body: "Unworn items returnable within 7 days. Sale items final." },
    { kind: "refunds", body: "Approved refunds processed within 5–7 business days." },
  ];
  const aiConfig: AiConfig = { assistant_name: "Amaka", tone: "friendly", language: "en", welcome_message: "Hi! Welcome to Paul's Fashion Store 👋 I'm Amaka — ask me about hoodies, sneakers, jeans, prices or delivery!", fallback_message: "Let me connect you with a member of our team who can help with that.", response_length: "medium", handoff_behavior: "on_request", is_active: true };
  const customers: Customer[] = [
    { id: "c1", name: "Chidinma O.", phone: "+234 803 111 2222", email: null, wa_id: "2348031112222" },
    { id: "c2", name: "Tunde A.", phone: "+234 706 123 4567", email: null, wa_id: "2347061234567" },
  ];
  const conversations: any[] = [
    { id: "v1", customer_id: "c1", status: "open", mode: "ai", tags: ["vip"], last_message: "Do you have the black hoodie in XL?", last_message_at: now(), unread: 1, customer: customers[0],
      messages: [
        { id: "m1", direction: "inbound", sender: "customer", body: "Hi, how much is the black hoodie?", status: "read", created_at: now() },
        { id: "m2", direction: "outbound", sender: "ai", body: "The Black Hoodie is ₦25,000, available in M–XXL. Would you like to order?", status: "read", created_at: now() },
        { id: "m3", direction: "inbound", sender: "customer", body: "Do you have the black hoodie in XL?", status: "received", created_at: now() },
      ], notes: [] },
    { id: "v2", customer_id: "c2", status: "human_handoff", mode: "human", tags: [], last_message: "I want to speak to someone about a bulk order.", last_message_at: now(), unread: 0, customer: customers[1],
      messages: [
        { id: "m4", direction: "inbound", sender: "customer", body: "I want to speak to someone about a bulk order.", status: "read", created_at: now() },
        { id: "m5", direction: "outbound", sender: "ai", body: "Sure. I'll connect you with a member of our team who can help with that.", status: "read", created_at: now() },
      ], notes: [] },
  ];
  const leads: Lead[] = [{ id: "l1", name: "Tunde A.", phone: "+234 706 123 4567", email: null, interest: "bulk_order", product: null, source: "whatsapp", status: "new", notes: "Bulk order — escalated to human.", created_at: now() }];
  const orders: Order[] = [{ id: "o1", status: "processing", total: 2500000, currency: "NGN", delivery_address: "5 Allen Ave, Ikeja, Lagos", payment_status: "pending", created_at: now(), customer_id: "c1" }];
  return { business, products, faqs, hours, policies, aiConfig, customers, conversations, leads, orders, whatsapp: null };
}
let store = seedStore();

function demoAi(message: string) {
  const m = message.toLowerCase();
  const handoffLine = store.aiConfig.fallback_message || "Let me connect you with a member of our team.";
  if (/(human|someone|speak|agent|complain|upset)/.test(m)) return { reply: handoffLine, intent: "human_request", handoff: true, sources: [{ type: "policy", ref: "escalation" }] };
  if (/(hour|open|close|what time)/.test(m)) return { reply: "Our hours:\n" + store.hours.map((h) => `${h.day[0].toUpperCase() + h.day.slice(1)}: ${h.is_open ? `${h.open_time}–${h.close_time}` : "closed"}`).join("\n"), intent: "business_hours_question", handoff: false, sources: [{ type: "hours", ref: "business_hours" }] };
  if (/(deliver|ship|dispatch)/.test(m)) { const d = store.policies.find((p) => p.kind === "delivery"); return { reply: d?.body || handoffLine, intent: "delivery_question", handoff: !d, sources: [{ type: "policy", ref: "delivery" }] }; }
  if (/(return|refund|exchange)/.test(m)) { const p = store.policies.filter((x) => ["returns", "refunds", "exchanges"].includes(x.kind)); return p.length ? { reply: p.map((x) => `${x.kind}: ${x.body}`).join("\n"), intent: "return_refund_question", handoff: false, sources: [{ type: "policy", ref: "returns" }] } : { reply: handoffLine, intent: "return_refund_question", handoff: true, sources: [] }; }
  const tokens = m.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !["how", "much", "the", "is", "price", "cost", "you", "your", "want", "need", "buy", "order"].includes(t));
  const matches = store.products.filter((p) => tokens.some((t) => `${p.name} ${p.category}`.toLowerCase().includes(t)));
  if (matches.length) {
    const lines = matches.map((p) => `• ${p.name} — ${demoMoney(p.price, p.currency)} (${p.stock_status.replace(/_/g, " ")})`).join("\n");
    return { reply: `${matches.length === 1 ? "" : "Here's what I found:\n"}${lines}\n\nWould you like more details?`, intent: "price_enquiry", handoff: false, sources: [{ type: "products", ref: matches.map((p) => p.name).join(", ") }] };
  }
  const faq = store.faqs.find((f) => f.question.toLowerCase().split(/\s+/).some((w) => w.length > 3 && m.includes(w)));
  if (faq) return { reply: faq.answer, intent: "general", handoff: false, sources: [{ type: "faq", ref: faq.question }] };
  return { reply: `I couldn't find that in our catalog. ${handoffLine}`, intent: "unknown", handoff: true, sources: [{ type: "policy", ref: "escalation" }] };
}

function demo(action: string, opts: Opts): any {
  const body: any = opts.body || {};
  switch (action) {
    case "me": return { ok: true, user: { id: "demo", name: "Demo Owner", picture: "" } };
    case "bootstrap": return { ok: true, business: store.business, aiConfig: store.aiConfig, whatsapp: store.whatsapp, aiProvider: { configured: false, provider: "retrieval-fallback", model: "retrieval-fallback" }, whatsappConfigured: false,
      counts: { conversationsToday: 2, aiResponsesToday: 5, humanHandoffs: 1, leads: store.leads.length, orders: store.orders.length, unresolved: 1, revenueMinor: 0 } };
    case "seed": return { ok: true, seeded: true };
    case "business.save": store.business = { ...store.business, ...body, social_links: body.social_links || store.business.social_links }; return { ok: true, business: store.business };
    case "hours.get": return { ok: true, hours: store.hours };
    case "hours.set": store.hours = body.hours; return { ok: true, hours: store.hours };
    case "policies.get": return { ok: true, policies: store.policies };
    case "policies.save": for (const p of body.policies || []) { const i = store.policies.findIndex((x) => x.kind === p.kind); if (i >= 0) store.policies[i] = p; else store.policies.push(p); } return { ok: true, policies: store.policies };
    case "products.list": return { ok: true, items: store.products };
    case "products.create": { const p = { ...body, id: uid(), price: body.price != null ? Math.round(body.price * 100) : null, currency: body.currency || "NGN" }; store.products.push(p); return { ok: true, item: p }; }
    case "products.update": { const i = store.products.findIndex((p) => p.id === body.id); if (i >= 0) store.products[i] = { ...store.products[i], ...body, price: body.price != null ? Math.round(body.price * 100) : store.products[i].price }; return { ok: true, item: store.products[i] }; }
    case "products.delete": store.products = store.products.filter((p) => p.id !== opts.query?.id); return { ok: true };
    case "faqs.list": return { ok: true, items: store.faqs };
    case "faqs.save": if (body.id) { const i = store.faqs.findIndex((f) => f.id === body.id); if (i >= 0) store.faqs[i] = { ...store.faqs[i], ...body }; } else store.faqs.push({ ...body, id: uid() }); return { ok: true };
    case "faqs.delete": store.faqs = store.faqs.filter((f) => f.id !== opts.query?.id); return { ok: true };
    case "aiConfig.get": return { ok: true, aiConfig: store.aiConfig, aiProvider: { configured: false, provider: "retrieval-fallback", model: "retrieval-fallback" } };
    case "aiConfig.save": store.aiConfig = { ...store.aiConfig, ...body }; return { ok: true, aiConfig: store.aiConfig };
    case "ai.test": { const r = demoAi(body.message || ""); return { ok: true, reply: r.reply, intent: r.intent, mode: "retrieval", sources: r.sources, handoff: r.handoff, usage: { model: "retrieval-fallback", prompt_tokens: 0, completion_tokens: 0, estimated_cost_micro: 0 }, aiError: null }; }
    case "whatsapp.get": return { ok: true, whatsapp: store.whatsapp, platformConfigured: false, verifyTokenSet: false };
    case "whatsapp.save": store.whatsapp = { ...(store.whatsapp || { id: uid() }), ...body }; return { ok: true, whatsapp: store.whatsapp };
    case "whatsapp.test": return { ok: false, error: "whatsapp_not_configured", hint: "Demo mode: configure META_ACCESS_TOKEN to send." };
    case "customers.list": return { ok: true, items: store.customers };
    case "conversations.list": { const items = store.conversations.filter((c) => !opts.query?.status || c.status === opts.query.status).map(({ messages, notes, ...c }) => c); return { ok: true, items }; }
    case "conversations.get": { const c = store.conversations.find((x) => x.id === opts.query?.id); if (c) c.unread = 0; return { ok: true, conversation: c ? { ...c, messages: undefined } : null, messages: c?.messages || [] }; }
    case "conversations.reply": { const c = store.conversations.find((x) => x.id === body.id); if (c) { c.messages.push({ id: uid(), direction: "outbound", sender: "human", body: body.message, status: "sent", created_at: now() }); c.last_message = body.message; c.mode = "human"; c.status = c.status === "resolved" ? "resolved" : "human_handoff"; } return { ok: true, delivered: false, whatsappConfigured: false }; }
    case "conversations.takeover": { const c = store.conversations.find((x) => x.id === body.id); if (c) { c.mode = "human"; c.status = "human_handoff"; } return { ok: true, conversation: c }; }
    case "conversations.returnToAi": { const c = store.conversations.find((x) => x.id === body.id); if (c) { c.mode = "ai"; c.status = "open"; } return { ok: true, conversation: c }; }
    case "conversations.resolve": { const c = store.conversations.find((x) => x.id === body.id); if (c) c.status = "resolved"; return { ok: true, conversation: c }; }
    case "conversations.tag": { const c = store.conversations.find((x) => x.id === body.id); if (c) c.tags = body.tags; return { ok: true, tags: body.tags }; }
    case "conversations.note": { const c = store.conversations.find((x) => x.id === body.id); c?.notes.push({ id: uid(), body: body.note, author: "Owner", created_at: now() }); return { ok: true }; }
    case "leads.list": return { ok: true, items: store.leads };
    case "leads.save": if (body.id) { const i = store.leads.findIndex((l) => l.id === body.id); if (i >= 0) store.leads[i] = { ...store.leads[i], ...body }; } else store.leads.unshift({ ...body, id: uid(), created_at: now() }); return { ok: true };
    case "leads.delete": store.leads = store.leads.filter((l) => l.id !== opts.query?.id); return { ok: true };
    case "orders.list": return { ok: true, items: store.orders };
    case "orders.save": store.orders.unshift({ ...body, id: uid(), total: body.total != null ? Math.round(body.total * 100) : 0, currency: "NGN", created_at: now() }); return { ok: true };
    case "analytics": return { ok: true, range: "30d", totals: { conversations: 2, aiHandled: 1, humanHandled: 1, handoffRate: 50, leads: store.leads.length, orders: store.orders.length, convertedLeads: 0, aiMessages: 2, aiInteractions: 5, estimatedCostMicro: 0, revenueMinor: 0 }, intents: [{ intent: "price_enquiry", count: 3 }, { intent: "delivery_question", count: 2 }, { intent: "human_request", count: 1 }], series: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10), conversations: [0, 1, 0, 2, 1, 3, 2, 1, 0, 2, 1, 4, 2, 3][i] })) };
    default: return { ok: true };
  }
}
