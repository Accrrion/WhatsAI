// AI orchestration layer: intent detection -> context/tool retrieval -> generation
// -> validation. Works in two modes:
//   "llm"        a configured OpenAI-compatible provider drives tool calls.
//   "retrieval"  deterministic, fully grounded responder used when no AI key is
//                configured (demo mode). It composes answers ONLY from tool data.
import { chat, resolveAiConfig, estimateCostMicro } from "./provider.mjs";
import { buildSystemPrompt } from "./prompts.mjs";
import {
  TOOL_SCHEMAS, executeTool, searchProducts, getProductDetails, checkAvailability,
  getBusinessHours, getDeliveryInformation, getPolicies, getFaqs, formatMoney, createLead,
} from "./tools.mjs";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function detectIntent(text) {
  const t = String(text || "").toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("human", "agent", "someone", "speak to", "talk to", "real person", "customer care", "representative")) return "human_request";
  if (has("complain", "angry", "upset", "terrible", "worst", "refund me now", "fraud", "scam", "report")) return "complaint";
  if (has("deliver", "shipping", "ship ", "dispatch", "how long to arrive", "courier")) return "delivery_question";
  if (has("return", "refund", "exchange", "damaged", "wrong item")) return "return_refund_question";
  if (has("open", "close", "opening hour", "business hour", "what time", "resume", "closed on")) return "business_hours_question";
  if (has("where are you", "location", "address", "shop address", "find you", "store location", "map")) return "location_question";
  if (has("how much", "price", "cost", "pricing", "₦", "naira", "rate")) return "price_enquiry";
  if (has("available", "availability", "in stock", "stock", "do you have", "any left")) return "availability_enquiry";
  if (has("order", "buy", "purchase", "i want", "i need", "place an order", "checkout", "pay")) return "order_request";
  if (has("hello", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy")) return "greeting";
  if (has("product", "item", "sell", "catalog", "catalogue", "what do you have")) return "product_enquiry";
  if (t.trim().length === 0) return "unknown";
  return "general";
}

function trimHistory(history, maxMessages = 12) {
  return (history || []).slice(-maxMessages).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  }));
}

function formatHours(hours, onlyToday) {
  if (onlyToday) {
    const day = DAY_NAMES[new Date().getUTCDay()];
    const row = hours.find((h) => h.day === day);
    if (!row) return null;
    return row.is_open ? `${cap(day)}: ${row.open_time}–${row.close_time}` : `${cap(day)}: closed`;
  }
  const lines = hours.map((h) => `${cap(h.day)}: ${h.is_open ? `${h.open_time}–${h.close_time}` : "closed"}`);
  return lines.join("\n");
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function productLine(p) {
  const price = p.price == null ? "price on request" : formatMoney(p.price, p.currency);
  const stock = p.stock_status ? ` (${p.stock_status.replace(/_/g, " ")})` : "";
  return `• ${p.name} — ${price}${stock}`;
}

function matchFaq(faqs, text) {
  const needle = text.toLowerCase();
  let best = null;
  for (const f of faqs) {
    const qwords = String(f.question).toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const score = qwords.filter((w) => needle.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { score, faq: f };
  }
  return best ? best.faq : null;
}

// Deterministic grounded responder. Never fabricates: only uses retrieved data.
async function retrievalRespond(ctx, message, intent) {
  const { supabase, businessId, business, aiConfig } = ctx;
  const sources = [];
  const fallback = aiConfig?.fallback_message || "Let me connect you with a member of our team who can help with that.";
  const handoff = () => ({ handoff: true });

  if (intent === "greeting") {
    const welcome = aiConfig?.welcome_message || `Hi! Welcome to ${business?.name || "our business"}. How can I help you today?`;
    return { reply: welcome, sources, ...handoffFlag(false) };
  }

  if (intent === "human_request" || intent === "complaint") {
    sources.push({ type: "policy", ref: "escalation" });
    return { reply: intent === "complaint"
      ? `I'm sorry you're having this experience. ${fallback}`
      : fallback, sources, ...handoff() };
  }

  if (intent === "business_hours_question") {
    const hours = await getBusinessHours(supabase, businessId);
    sources.push({ type: "hours", ref: "business_hours" });
    if (!hours.length) return { reply: fallback, sources, ...handoff() };
    const today = formatHours(hours, true);
    return { reply: `Our opening hours:\n${formatHours(hours, false)}`, sources, ...handoffFlag(false), meta: { today } };
  }

  if (intent === "delivery_question") {
    const delivery = await getDeliveryInformation(supabase, businessId);
    sources.push({ type: "policy", ref: "delivery" });
    if (!delivery) return { reply: `I don't have our delivery details on hand yet. ${fallback}`, sources, ...handoff() };
    return { reply: delivery, sources, ...handoffFlag(false) };
  }

  if (intent === "return_refund_question") {
    const policies = await getPolicies(supabase, businessId);
    const relevant = policies.filter((p) => ["returns", "refunds", "exchanges"].includes(p.kind));
    sources.push({ type: "policy", ref: "returns" });
    if (!relevant.length) return { reply: `I don't have our return/refund policy on hand yet. ${fallback}`, sources, ...handoff() };
    return { reply: relevant.map((p) => `${cap(p.kind)}: ${p.body}`).join("\n"), sources, ...handoffFlag(false) };
  }

  if (intent === "location_question") {
    sources.push({ type: "business", ref: "location" });
    if (!business?.location) return { reply: `I don't have our address on hand yet. ${fallback}`, sources, ...handoff() };
    return { reply: `You can find us at: ${business.location}`, sources, ...handoffFlag(false) };
  }

  if (intent === "price_enquiry" || intent === "product_enquiry" || intent === "availability_enquiry" || intent === "order_request") {
    if (intent === "availability_enquiry") {
      const avail = await checkAvailability(supabase, businessId, message);
      if (avail.found) {
        sources.push({ type: "product", ref: avail.name });
        const status = (avail.stock_status || "unknown").replace(/_/g, " ");
        return { reply: `${avail.name}: ${status}.`, sources, ...handoffFlag(false) };
      }
    }
    const products = await searchProducts(supabase, businessId, message, 4);
    if (products.length) {
      sources.push({ type: "products", ref: products.map((p) => p.name).join(", ") });
      const lines = products.map(productLine).join("\n");
      const single = products.length === 1;
      const detail = single && products[0].description ? `\n${products[0].description}` : "";
      const cta = intent === "order_request"
        ? `\n\nTo order, tell me which item and your delivery details, and I'll pass it to the team.`
        : `\n\nWould you like more details on any of these?`;
      return { reply: `${single ? "" : "Here's what I found:\n"}${lines}${detail}${cta}`, sources, ...handoffFlag(false) };
    }
    // Nothing matched: do not invent. Offer FAQ or escalate.
    const faqs = await getFaqs(supabase, businessId);
    const faq = matchFaq(faqs, message);
    if (faq) {
      sources.push({ type: "faq", ref: faq.question });
      return { reply: faq.answer, sources, ...handoffFlag(false) };
    }
    sources.push({ type: "policy", ref: "escalation" });
    return { reply: `I couldn't find that in our catalog. ${fallback}`, sources, ...handoff() };
  }

  // general / unknown: try FAQ, else escalate.
  const faqs = await getFaqs(supabase, businessId);
  const faq = matchFaq(faqs, message);
  if (faq) {
    sources.push({ type: "faq", ref: faq.question });
    return { reply: faq.answer, sources, ...handoffFlag(false) };
  }
  sources.push({ type: "policy", ref: "escalation" });
  return { reply: fallback, sources, ...handoff() };
}

const handoffFlag = (v) => ({ handoff: v });

function sanitizeReply(text, fallback) {
  let reply = String(text || "").trim();
  // Defensive: strip anything that looks like a leaked secret/system content.
  reply = reply.replace(/(api[_-]?key|bearer\s+[a-z0-9._-]+|sk-[a-z0-9]{10,})/gi, "[redacted]");
  if (!reply) reply = fallback;
  if (reply.length > 1500) reply = reply.slice(0, 1500).trimEnd() + "…";
  return reply;
}

export async function runOrchestrator(ctx) {
  const { supabase, businessId, business, aiConfig, history, message, customer } = ctx;
  const intent = detectIntent(message);
  const cfg = resolveAiConfig(ctx.env);
  const fallback = aiConfig?.fallback_message || "Let me connect you with a member of our team who can help with that.";

  if (!cfg.configured) {
    const result = await retrievalRespond(ctx, message, intent);
    // Lightweight lead capture in demo mode: buying intent + a phone number.
    let lead = null;
    const phoneMatch = String(message).match(/(\+?\d[\d\s-]{7,}\d)/);
    if (phoneMatch && ["order_request", "product_enquiry", "price_enquiry"].includes(intent)) {
      try {
        lead = await createLead(supabase, businessId, {
          customer_id: customer?.id || null, name: customer?.name || null,
          phone: phoneMatch[1].trim(), interest: intent, source: "whatsapp",
        });
      } catch { /* lead capture is best-effort */ }
    }
    return {
      reply: sanitizeReply(result.reply, fallback), intent, mode: "retrieval",
      sources: result.sources || [], handoff: Boolean(result.handoff), lead,
      usage: { prompt_tokens: 0, completion_tokens: 0, model: "retrieval-fallback", estimated_cost_micro: 0 },
    };
  }

  // LLM path with tool calling (max 3 rounds).
  const messages = [
    { role: "system", content: buildSystemPrompt({ aiConfig, business }) },
    ...trimHistory(history),
    { role: "user", content: String(message).slice(0, 4000) },
  ];
  const sources = [];
  let handoff = false;
  let lead = null;
  let usage = { prompt_tokens: 0, completion_tokens: 0, model: cfg.model, estimated_cost_micro: 0 };
  let finalText = "";

  for (let round = 0; round < 3; round++) {
    const res = await chat(ctx.env, { messages, tools: TOOL_SCHEMAS, maxTokens: 500 });
    if (!res) break;
    if (res.error) {
      const fb = await retrievalRespond(ctx, message, intent);
      return { reply: sanitizeReply(fb.reply, fallback), intent, mode: "retrieval", sources: fb.sources, handoff: Boolean(fb.handoff), lead: null, usage, aiError: res.error };
    }
    usage.prompt_tokens += res.usage?.prompt_tokens || 0;
    usage.completion_tokens += res.usage?.completion_tokens || 0;
    const toolCalls = res.toolCalls || [];
    if (!toolCalls.length) { finalText = res.content; break; }

    messages.push({ role: "assistant", content: res.content || "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      const name = call?.function?.name;
      let args = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      let result;
      try { result = await executeTool({ supabase, businessId }, name, args); }
      catch { result = { error: "tool_failed" }; }
      if (name && !sources.some((s) => s.ref === name)) sources.push({ type: "tool", ref: name });
      if (name === "request_human_handoff" || (result && result.handoff_requested)) handoff = true;
      if (name === "create_lead" && result && result.id) lead = result;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 4000) });
    }
    if (round === 2) {
      const last = await chat(ctx.env, { messages, maxTokens: 400 });
      if (last && !last.error) { finalText = last.content; usage.prompt_tokens += last.usage?.prompt_tokens || 0; usage.completion_tokens += last.usage?.completion_tokens || 0; }
    }
  }

  usage.estimated_cost_micro = estimateCostMicro(usage);
  if (!finalText) {
    const fb = await retrievalRespond(ctx, message, intent);
    finalText = fb.reply;
    sources.push(...(fb.sources || []));
    handoff = handoff || Boolean(fb.handoff);
  }
  return { reply: sanitizeReply(finalText, fallback), intent, mode: "llm", sources, handoff, lead, usage };
}
