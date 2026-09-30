// Tenant-scoped business routes. Every handler derives the business from the
// authenticated user (owner_user_id) and never trusts client-supplied ids for
// authorization. Child records are always filtered by the resolved business_id.
import {
  ok, fail, appError, readJson, str, optStr, int, bool, oneOf, uuid as vuuid, json,
  requireBusiness, getBusinessForUser, ownedRecord, nowIso, newId, parseSocialLinks,
} from "./db.mjs";
import { formatMoney } from "./ai/tools.mjs";
import { runOrchestrator, detectIntent } from "./ai/orchestrator.mjs";
import { resolveAiConfig } from "./ai/provider.mjs";
import { sendText, whatsappConfigured } from "./whatsapp/client.mjs";
import { seedDemo } from "./seed.mjs";

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES"];
const STOCK = ["in_stock", "low_stock", "out_of_stock", "preorder"];
const TONES = ["professional", "friendly", "casual", "luxury", "energetic"];
const LANGS = ["en", "pcm", "yo", "ig", "ha"];
const LENGTHS = ["short", "medium", "detailed"];
const HANDOFF = ["on_request", "on_unknown", "always", "never"];
const LEAD_STATUS = ["new", "contacted", "qualified", "converted", "lost"];
const ORDER_STATUS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUS = ["unpaid", "pending", "paid", "failed", "refunded"];
const POLICY_KINDS = ["delivery", "returns", "refunds", "exchanges", "payments", "cancellations"];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const toMinor = (major) => Math.round(Number(major) * 100);

async function list(supabase, table, businessId, columns, order = "created_at") {
  const { data, error } = await supabase.from(table).select(columns).eq("business_id", businessId).order(order, { ascending: false });
  if (error) throw appError("db_error", 503);
  return data || [];
}

// ---- account / bootstrap ---------------------------------------------------
export async function me(ctx) {
  return ok({ user: { id: ctx.user.user_id, name: ctx.user.name, picture: ctx.user.picture } });
}

export async function bootstrap(ctx) {
  const { supabase, user } = ctx;
  const business = await getBusinessForUser(supabase, user.user_id);
  if (!business) return ok({ business: null });
  const bid = business.id;
  const [aiConfig, whatsapp, counts] = await Promise.all([
    supabase.from("ai_configs").select("*").eq("business_id", bid).maybeSingle(),
    supabase.from("whatsapp_accounts").select("id,phone_number_id,waba_id,display_phone,status,connected_at").eq("business_id", bid).maybeSingle(),
    overviewCounts(supabase, bid),
  ]);
  if (aiConfig.error) throw appError("db_error", 503);
  const ai = resolveAiConfig(ctx.env);
  return ok({
    business, aiConfig: aiConfig.data || null, whatsapp: whatsapp.data || null, counts,
    aiProvider: { configured: ai.configured, provider: ai.provider, model: ai.configured ? ai.model : "retrieval-fallback" },
    whatsappConfigured: whatsappConfigured(ctx.env),
  });
}

async function overviewCounts(supabase, bid) {
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();
  const [convToday, aiResponses, handoffs, leads, orders, unresolved, revenueRes] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: false }).eq("business_id", bid).gte("created_at", iso).limit(1),
    supabase.from("ai_interactions").select("id", { count: "exact", head: false }).eq("business_id", bid).gte("created_at", iso).limit(1),
    supabase.from("conversations").select("id", { count: "exact", head: false }).eq("business_id", bid).eq("status", "human_handoff").limit(1),
    supabase.from("leads").select("id", { count: "exact", head: false }).eq("business_id", bid).limit(1),
    supabase.from("orders").select("id", { count: "exact", head: false }).eq("business_id", bid).limit(1),
    supabase.from("conversations").select("id", { count: "exact", head: false }).eq("business_id", bid).eq("status", "open").limit(1),
    supabase.from("orders").select("total").eq("business_id", bid).in("payment_status", ["paid"]),
  ]);
  const c = (r) => (r.error ? 0 : (r.count || 0));
  const revenue = revenueRes.error ? 0 : (revenueRes.data || []).reduce((s, o) => s + (o.total || 0), 0);
  return { conversationsToday: c(convToday), aiResponsesToday: c(aiResponses), humanHandoffs: c(handoffs), leads: c(leads), orders: c(orders), unresolved: c(unresolved), revenueMinor: revenue };
}

export async function seed(ctx) {
  const result = await seedDemo(ctx.supabase, ctx.user.user_id);
  return ok({ seeded: true, ...result });
}

// ---- business profile ------------------------------------------------------
export async function businessSave(ctx) {
  const { supabase, user } = ctx;
  const body = await readJson(ctx.request);
  const existing = await getBusinessForUser(supabase, user.user_id);
  const fields = {
    name: str(body.name, { max: 120, required: !existing }),
    business_type: oneOf(body.business_type, ["fashion", "restaurant", "salon", "barber", "beauty", "electronics", "retail", "services", "real_estate", "other"], { fallback: "retail" }),
    description: optStr(body.description, 1000),
    location: optStr(body.location, 300),
    phone: optStr(body.phone, 40),
    email: optStr(body.email, 160),
    website: optStr(body.website, 300),
    social_links: parseSocialLinks(body.social_links),
    currency: oneOf(body.currency, CURRENCIES, { fallback: existing?.currency || "NGN" }),
    onboarding_step: int(body.onboarding_step, { min: 1, max: 11, fallback: existing?.onboarding_step || 1 }),
  };
  if (existing) {
    const { data, error } = await supabase.from("businesses").update({ ...fields, updated_at: nowIso() }).eq("id", existing.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ business: data });
  }
  const row = { id: newId(), owner_user_id: user.user_id, ...fields, created_at: nowIso(), updated_at: nowIso() };
  const { data, error } = await supabase.from("businesses").insert(row).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ business: data, created: true });
}

export async function hoursSet(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const body = await readJson(ctx.request);
  const hours = Array.isArray(body.hours) ? body.hours : [];
  if (hours.length > 7) throw appError("invalid_field", 400);
  // Replace-all: delete then insert (simple, bounded, tenant-scoped).
  const { error: delErr } = await supabase.from("business_hours").delete().eq("business_id", business.id);
  if (delErr) throw appError("db_error", 503);
  const rows = [];
  for (const h of hours) {
    const day = oneOf(h.day, DAYS, { required: true });
    rows.push({
      id: newId(), business_id: business.id, day, is_open: bool(h.is_open, false),
      open_time: optStr(h.open_time, 8), close_time: optStr(h.close_time, 8),
    });
  }
  if (rows.length) { const { error } = await supabase.from("business_hours").insert(rows); if (error) throw appError("db_error", 503); }
  return ok({ hours: rows });
}

export async function hoursGet(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const { data, error } = await supabase.from("business_hours").select("day,is_open,open_time,close_time").eq("business_id", business.id);
  if (error) throw appError("db_error", 503);
  return ok({ hours: data || [] });
}

export async function policiesSave(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const body = await readJson(ctx.request);
  const policies = Array.isArray(body.policies) ? body.policies : [];
  for (const p of policies) {
    const kind = oneOf(p.kind, POLICY_KINDS, { required: true });
    const text = optStr(p.body, 2000) || "";
    const { data: existing } = await supabase.from("policies").select("id").eq("business_id", business.id).eq("kind", kind).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("policies").update({ body: text }).eq("id", existing.id);
      if (error) throw appError("db_error", 503);
    } else {
      const { error } = await supabase.from("policies").insert({ id: newId(), business_id: business.id, kind, body: text });
      if (error) throw appError("db_error", 503);
    }
  }
  const { data } = await supabase.from("policies").select("kind,body").eq("business_id", business.id);
  return ok({ policies: data || [] });
}

export async function policiesGet(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const { data, error } = await supabase.from("policies").select("kind,body").eq("business_id", business.id);
  if (error) throw appError("db_error", 503);
  return ok({ policies: data || [] });
}

// ---- generic knowledge CRUD ------------------------------------------------
function productFromBody(body, business) {
  return {
    name: str(body.name, { max: 140, required: true }),
    description: optStr(body.description, 2000),
    price: body.price === undefined || body.price === null ? null : toMinor(int(body.price, { min: 0, max: 1e9 })),
    currency: oneOf(body.currency, CURRENCIES, { fallback: business.currency || "NGN" }),
    category: optStr(body.category, 80),
    stock_status: oneOf(body.stock_status, STOCK, { fallback: "in_stock" }),
    sku: optStr(body.sku, 64),
    image_url: optStr(body.image_url, 600),
    variants: json(body.variants, {}),
  };
}

export async function productsList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "products", business.id, "id,name,description,price,currency,category,stock_status,sku,image_url,variants,created_at,updated_at", "name");
  return ok({ items });
}
export async function productsCreate(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = { id: newId(), business_id: business.id, ...productFromBody(body, business), created_at: nowIso(), updated_at: nowIso() };
  const { data, error } = await ctx.supabase.from("products").insert(row).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ item: data });
}
export async function productsUpdate(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  await ownedRecord(ctx.supabase, "products", id, business.id, "id");
  const patch = productFromBody({ ...(await ownedRecord(ctx.supabase, "products", id, business.id)), ...body }, business);
  const { data, error } = await ctx.supabase.from("products").update({ ...patch, updated_at: nowIso() }).eq("id", id).eq("business_id", business.id).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ item: data });
}
export async function productsDelete(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const id = vuuid(new URL(ctx.request.url).searchParams.get("id"));
  const { data, error } = await ctx.supabase.from("products").delete().eq("id", id).eq("business_id", business.id).select("id").maybeSingle();
  if (error) throw appError("db_error", 503);
  if (!data) throw appError("not_found", 404);
  return ok({ deleted: id });
}

export async function servicesList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "services", business.id, "id,name,description,price,currency,duration_minutes,availability,created_at", "name");
  return ok({ items });
}
export async function servicesSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = {
    name: str(body.name, { max: 140, required: true }), description: optStr(body.description, 2000),
    price: body.price === undefined || body.price === null ? null : toMinor(int(body.price, { min: 0, max: 1e9 })),
    currency: oneOf(body.currency, CURRENCIES, { fallback: business.currency || "NGN" }),
    duration_minutes: int(body.duration_minutes, { min: 0, max: 100000, fallback: 0 }), availability: optStr(body.availability, 200),
  };
  if (body.id) {
    const id = vuuid(body.id);
    await ownedRecord(ctx.supabase, "services", id, business.id, "id");
    const { data, error } = await ctx.supabase.from("services").update(row).eq("id", id).eq("business_id", business.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ item: data });
  }
  const { data, error } = await ctx.supabase.from("services").insert({ id: newId(), business_id: business.id, ...row, created_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ item: data });
}
export async function servicesDelete(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const id = vuuid(new URL(ctx.request.url).searchParams.get("id"));
  const { data, error } = await ctx.supabase.from("services").delete().eq("id", id).eq("business_id", business.id).select("id").maybeSingle();
  if (error) throw appError("db_error", 503);
  if (!data) throw appError("not_found", 404);
  return ok({ deleted: id });
}

export async function faqsList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "faqs", business.id, "id,question,answer,created_at", "created_at");
  return ok({ items });
}
export async function faqsSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = { question: str(body.question, { max: 300, required: true }), answer: str(body.answer, { max: 2000, required: true }) };
  if (body.id) {
    const id = vuuid(body.id);
    await ownedRecord(ctx.supabase, "faqs", id, business.id, "id");
    const { data, error } = await ctx.supabase.from("faqs").update(row).eq("id", id).eq("business_id", business.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ item: data });
  }
  const { data, error } = await ctx.supabase.from("faqs").insert({ id: newId(), business_id: business.id, ...row, created_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ item: data });
}
export async function faqsDelete(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const id = vuuid(new URL(ctx.request.url).searchParams.get("id"));
  const { data, error } = await ctx.supabase.from("faqs").delete().eq("id", id).eq("business_id", business.id).select("id").maybeSingle();
  if (error) throw appError("db_error", 503);
  if (!data) throw appError("not_found", 404);
  return ok({ deleted: id });
}

// ---- AI config -------------------------------------------------------------
export async function aiConfigGet(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const { data, error } = await ctx.supabase.from("ai_configs").select("*").eq("business_id", business.id).maybeSingle();
  if (error) throw appError("db_error", 503);
  const ai = resolveAiConfig(ctx.env);
  return ok({ aiConfig: data || null, aiProvider: { configured: ai.configured, provider: ai.provider, model: ai.configured ? ai.model : "retrieval-fallback" } });
}
export async function aiConfigSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = {
    assistant_name: optStr(body.assistant_name, 60) || "Assistant",
    tone: oneOf(body.tone, TONES, { fallback: "friendly" }),
    language: oneOf(body.language, LANGS, { fallback: "en" }),
    welcome_message: optStr(body.welcome_message, 500),
    fallback_message: optStr(body.fallback_message, 500),
    response_length: oneOf(body.response_length, LENGTHS, { fallback: "medium" }),
    handoff_behavior: oneOf(body.handoff_behavior, HANDOFF, { fallback: "on_request" }),
    is_active: bool(body.is_active, true),
  };
  const { data: existing } = await ctx.supabase.from("ai_configs").select("id").eq("business_id", business.id).maybeSingle();
  if (existing) {
    const { data, error } = await ctx.supabase.from("ai_configs").update({ ...row, updated_at: nowIso() }).eq("id", existing.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ aiConfig: data });
  }
  const { data, error } = await ctx.supabase.from("ai_configs").insert({ id: newId(), business_id: business.id, ...row, updated_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ aiConfig: data });
}

// ---- AI sandbox (test interface) ------------------------------------------
export async function aiTest(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const body = await readJson(ctx.request);
  const message = str(body.message, { max: 2000, required: true });
  const history = Array.isArray(body.history) ? body.history.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 2000) })) : [];
  const { data: aiConfig } = await supabase.from("ai_configs").select("*").eq("business_id", business.id).maybeSingle();
  const result = await runOrchestrator({ supabase, env: ctx.env, businessId: business.id, business, aiConfig: aiConfig || undefined, history, message, customer: null });
  return ok({
    reply: result.reply, intent: result.intent, mode: result.mode, sources: result.sources,
    handoff: result.handoff, usage: result.usage, aiError: result.aiError || null,
  });
}

// ---- WhatsApp connection ---------------------------------------------------
export async function whatsappGet(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const { data, error } = await ctx.supabase.from("whatsapp_accounts").select("id,phone_number_id,waba_id,display_phone,status,connected_at,updated_at").eq("business_id", business.id).maybeSingle();
  if (error) throw appError("db_error", 503);
  return ok({ whatsapp: data || null, platformConfigured: whatsappConfigured(ctx.env), verifyTokenSet: Boolean(ctx.env("META_VERIFY_TOKEN")) });
}
export async function whatsappSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = {
    phone_number_id: optStr(body.phone_number_id, 64),
    waba_id: optStr(body.waba_id, 64),
    display_phone: optStr(body.display_phone, 40),
    status: oneOf(body.status, ["not_connected", "connecting", "connected", "error", "disconnected"], { fallback: "connecting" }),
  };
  const { data: existing } = await ctx.supabase.from("whatsapp_accounts").select("id").eq("business_id", business.id).maybeSingle();
  if (existing) {
    const { data, error } = await ctx.supabase.from("whatsapp_accounts").update({ ...row, updated_at: nowIso() }).eq("id", existing.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ whatsapp: data });
  }
  const { data, error } = await ctx.supabase.from("whatsapp_accounts").insert({ id: newId(), business_id: business.id, ...row, connected_at: nowIso(), updated_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ whatsapp: data });
}
export async function whatsappTest(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const to = str(body.to, { max: 32, required: true }).replace(/[^\d+]/g, "");
  const { data: account } = await ctx.supabase.from("whatsapp_accounts").select("phone_number_id").eq("business_id", business.id).maybeSingle();
  if (!whatsappConfigured(ctx.env)) return fail("whatsapp_not_configured", 400, { hint: "Set META_ACCESS_TOKEN in Sites Settings." });
  if (!account?.phone_number_id) return fail("whatsapp_not_connected", 400, { hint: "Save your WhatsApp Phone Number ID first." });
  const res = await sendText(ctx.env, { phoneNumberId: account.phone_number_id, to, text: `Test message from ${business.name}'s WhatsAI assistant.` });
  if (!res.ok) return fail(res.error, 502);
  return ok({ sent: true, messageId: res.messageId });
}

// ---- customers / conversations --------------------------------------------
export async function customersList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "customers", business.id, "id,name,phone,email,wa_id,created_at", "created_at");
  return ok({ items });
}

export async function conversationsList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status");
  let builder = ctx.supabase.from("conversations").select("id,customer_id,status,mode,tags,last_message,last_message_at,unread,created_at").eq("business_id", business.id);
  if (status && ["open", "human_handoff", "resolved"].includes(status)) builder = builder.eq("status", status);
  const { data, error } = await builder.order("last_message_at", { ascending: false }).limit(100);
  if (error) throw appError("db_error", 503);
  const convs = data || [];
  const customerIds = [...new Set(convs.map((c) => c.customer_id))];
  let customers = [];
  if (customerIds.length) {
    const { data: cs } = await ctx.supabase.from("customers").select("id,name,phone,wa_id").in("id", customerIds);
    customers = cs || [];
  }
  const cmap = Object.fromEntries(customers.map((c) => [c.id, c]));
  return ok({ items: convs.map((c) => ({ ...c, customer: cmap[c.customer_id] || null })) });
}

export async function conversationsGet(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const id = vuuid(new URL(ctx.request.url).searchParams.get("id"));
  const conv = await ownedRecord(ctx.supabase, "conversations", id, business.id);
  const { data: msgs, error } = await ctx.supabase.from("messages").select("id,direction,sender,body,status,created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(200);
  if (error) throw appError("db_error", 503);
  const { data: customer } = await ctx.supabase.from("customers").select("id,name,phone,email,wa_id").eq("id", conv.customer_id).maybeSingle();
  // Mark read.
  await ctx.supabase.from("conversations").update({ unread: 0 }).eq("id", id).eq("business_id", business.id);
  return ok({ conversation: { ...conv, unread: 0, customer: customer || null }, messages: msgs || [] });
}

async function setConvMode(ctx, business, id, patch) {
  const { data, error } = await ctx.supabase.from("conversations").update({ ...patch, updated_at: nowIso() }).eq("id", id).eq("business_id", business.id).select("id,status,mode").single();
  if (error) throw appError("db_error", 503);
  return data;
}

export async function conversationsTakeover(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  await ownedRecord(ctx.supabase, "conversations", id, business.id, "id");
  const conv = await setConvMode(ctx, business, id, { mode: "human", status: "human_handoff" });
  return ok({ conversation: conv });
}
export async function conversationsReturnToAi(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  await ownedRecord(ctx.supabase, "conversations", id, business.id, "id");
  const conv = await setConvMode(ctx, business, id, { mode: "ai", status: "open" });
  return ok({ conversation: conv });
}
export async function conversationsResolve(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  await ownedRecord(ctx.supabase, "conversations", id, business.id, "id");
  const conv = await setConvMode(ctx, business, id, { status: "resolved" });
  return ok({ conversation: conv });
}
export async function conversationsTag(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 20).map((t) => str(t, { max: 30 })).filter(Boolean) : [];
  await ownedRecord(ctx.supabase, "conversations", id, business.id, "id");
  const { error } = await ctx.supabase.from("conversations").update({ tags, updated_at: nowIso() }).eq("id", id).eq("business_id", business.id);
  if (error) throw appError("db_error", 503);
  return ok({ tags });
}
export async function conversationsNote(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  const note = str(body.note, { max: 1000, required: true });
  await ownedRecord(ctx.supabase, "conversations", id, business.id, "id");
  const { data, error } = await ctx.supabase.from("conversation_notes").insert({ id: newId(), conversation_id: id, business_id: business.id, author: ctx.user.name || "Owner", body: note, created_at: nowIso() }).select("id,body,author,created_at").single();
  if (error) throw appError("db_error", 503);
  return ok({ note: data });
}
export async function conversationsReply(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const body = await readJson(ctx.request);
  const id = vuuid(body.id);
  const text = str(body.message, { max: 4000, required: true });
  const conv = await ownedRecord(supabase, "conversations", id, business.id);
  const row = { id: newId(), conversation_id: id, business_id: business.id, direction: "outbound", sender: "human", body: text, status: "pending", created_at: nowIso() };
  const { data: msg, error } = await supabase.from("messages").insert(row).select("*").single();
  if (error) throw appError("db_error", 503);
  await supabase.from("conversations").update({ last_message: text.slice(0, 500), last_message_at: nowIso(), mode: "human", status: conv.status === "resolved" ? "resolved" : "human_handoff", updated_at: nowIso() }).eq("id", id).eq("business_id", business.id);
  let delivered = false;
  if (whatsappConfigured(ctx.env)) {
    const { data: account } = await supabase.from("whatsapp_accounts").select("phone_number_id").eq("business_id", business.id).maybeSingle();
    const { data: customer } = await supabase.from("customers").select("wa_id").eq("id", conv.customer_id).maybeSingle();
    if (account?.phone_number_id && customer?.wa_id) {
      const res = await sendText(ctx.env, { phoneNumberId: account.phone_number_id, to: customer.wa_id, text });
      delivered = res.ok;
      await supabase.from("messages").update({ status: res.ok ? "sent" : "failed", wa_message_id: res.messageId || null }).eq("id", msg.id);
    }
  }
  return ok({ message: msg, delivered, whatsappConfigured: whatsappConfigured(ctx.env) });
}

// ---- leads -----------------------------------------------------------------
export async function leadsList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "leads", business.id, "id,customer_id,name,phone,email,interest,product,source,status,notes,created_at,updated_at");
  return ok({ items });
}
export async function leadsSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const row = {
    name: optStr(body.name, 160), phone: optStr(body.phone, 40), email: optStr(body.email, 160),
    interest: optStr(body.interest, 200), product: optStr(body.product, 200),
    source: oneOf(body.source, ["whatsapp", "ai", "manual", "web"], { fallback: "manual" }),
    status: oneOf(body.status, LEAD_STATUS, { fallback: "new" }), notes: optStr(body.notes, 1000),
  };
  if (body.id) {
    const id = vuuid(body.id);
    await ownedRecord(ctx.supabase, "leads", id, business.id, "id");
    const { data, error } = await ctx.supabase.from("leads").update({ ...row, updated_at: nowIso() }).eq("id", id).eq("business_id", business.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ item: data });
  }
  const { data, error } = await ctx.supabase.from("leads").insert({ id: newId(), business_id: business.id, customer_id: null, ...row, created_at: nowIso(), updated_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  return ok({ item: data });
}
export async function leadsDelete(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const id = vuuid(new URL(ctx.request.url).searchParams.get("id"));
  const { data, error } = await ctx.supabase.from("leads").delete().eq("id", id).eq("business_id", business.id).select("id").maybeSingle();
  if (error) throw appError("db_error", 503);
  if (!data) throw appError("not_found", 404);
  return ok({ deleted: id });
}

// ---- orders ----------------------------------------------------------------
export async function ordersList(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const items = await list(ctx.supabase, "orders", business.id, "id,customer_id,status,total,currency,delivery_address,payment_status,created_at,updated_at");
  return ok({ items });
}
export async function ordersSave(ctx) {
  const business = await requireBusiness(ctx.supabase, ctx.user.user_id);
  const body = await readJson(ctx.request);
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  let total = 0;
  const orderItems = [];
  for (const it of items) {
    const qty = int(it.quantity, { min: 1, max: 10000, fallback: 1 });
    let unitPrice = it.unit_price === undefined || it.unit_price === null ? null : toMinor(int(it.unit_price, { min: 0, max: 1e9 }));
    let name = optStr(it.name, 160);
    let productId = null;
    if (it.product_id) {
      productId = vuuid(it.product_id);
      const p = await ownedRecord(ctx.supabase, "products", productId, business.id);
      name = p.name; unitPrice = p.price;
    }
    if (unitPrice == null) unitPrice = 0;
    total += unitPrice * qty;
    orderItems.push({ id: newId(), product_id: productId, name: name || "Item", quantity: qty, unit_price: unitPrice });
  }
  const head = {
    status: oneOf(body.status, ORDER_STATUS, { fallback: "pending" }),
    total: body.total === undefined ? total : toMinor(int(body.total, { min: 0, max: 1e12 })),
    currency: oneOf(body.currency, CURRENCIES, { fallback: business.currency || "NGN" }),
    delivery_address: optStr(body.delivery_address, 500),
    payment_status: oneOf(body.payment_status, PAYMENT_STATUS, { fallback: "unpaid" }),
    customer_id: body.customer_id ? vuuid(body.customer_id) : null,
  };
  if (body.id) {
    const id = vuuid(body.id);
    await ownedRecord(ctx.supabase, "orders", id, business.id, "id");
    const { data, error } = await ctx.supabase.from("orders").update({ ...head, updated_at: nowIso() }).eq("id", id).eq("business_id", business.id).select("*").single();
    if (error) throw appError("db_error", 503);
    return ok({ item: data });
  }
  const orderId = newId();
  const { data, error } = await ctx.supabase.from("orders").insert({ id: orderId, business_id: business.id, ...head, created_at: nowIso(), updated_at: nowIso() }).select("*").single();
  if (error) throw appError("db_error", 503);
  if (orderItems.length) {
    const { error: iErr } = await ctx.supabase.from("order_items").insert(orderItems.map((oi) => ({ ...oi, order_id: orderId, business_id: business.id })));
    if (iErr) throw appError("db_error", 503);
  }
  return ok({ item: data });
}

// ---- analytics -------------------------------------------------------------
export async function analytics(ctx) {
  const { supabase, user } = ctx;
  const business = await requireBusiness(supabase, user.user_id);
  const bid = business.id;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [convs, interactions, leads, orders, messages] = await Promise.all([
    supabase.from("conversations").select("id,status,mode,created_at").eq("business_id", bid).gte("created_at", since),
    supabase.from("ai_interactions").select("intent,mode,prompt_tokens,completion_tokens,estimated_cost_micro,created_at").eq("business_id", bid).gte("created_at", since),
    supabase.from("leads").select("id,status,created_at").eq("business_id", bid).gte("created_at", since),
    supabase.from("orders").select("id,status,total,payment_status,created_at").eq("business_id", bid).gte("created_at", since),
    supabase.from("messages").select("direction,sender,created_at").eq("business_id", bid).gte("created_at", since),
  ]);
  const convList = convs.data || [], inter = interactions.data || [], leadList = leads.data || [], orderList = orders.data || [], msgList = messages.data || [];
  const aiHandled = convList.filter((c) => c.mode === "ai").length;
  const humanHandled = convList.filter((c) => c.mode === "human" || c.status === "human_handoff").length;
  const intentCounts = {};
  for (const i of inter) intentCounts[i.intent || "unknown"] = (intentCounts[i.intent || "unknown"] || 0) + 1;
  const costMicro = inter.reduce((s, i) => s + (i.estimated_cost_micro || 0), 0);
  const revenueMinor = orderList.filter((o) => o.payment_status === "paid").reduce((s, o) => s + (o.total || 0), 0);
  // Daily conversation series (last 14 days).
  const days = [];
  for (let d = 13; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5); day.setUTCHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    const count = convList.filter((c) => (c.created_at || "").slice(0, 10) === key).length;
    days.push({ day: key, conversations: count });
  }
  const aiMessages = msgList.filter((m) => m.sender === "ai").length;
  return ok({
    range: "30d",
    totals: {
      conversations: convList.length, aiHandled, humanHandled,
      handoffRate: convList.length ? Math.round((humanHandled / convList.length) * 100) : 0,
      leads: leadList.length, orders: orderList.length,
      convertedLeads: leadList.filter((l) => l.status === "converted").length,
      aiMessages, aiInteractions: inter.length, estimatedCostMicro: costMicro, revenueMinor,
    },
    intents: Object.entries(intentCounts).map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    series: days,
  });
}
