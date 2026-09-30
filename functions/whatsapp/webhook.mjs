// WhatsApp inbound webhook processing: idempotent, tenant-resolving, AI-driven.
// Public (no Qoder user context): the business is resolved from the receiving
// phone_number_id, and Meta's signature is verified by the caller.
import { runOrchestrator, detectIntent } from "../ai/orchestrator.mjs";
import { sendText, whatsappConfigured } from "./client.mjs";
import { appError } from "../db.mjs";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function findBusinessByPhoneNumber(supabase, phoneNumberId) {
  if (!phoneNumberId) return null;
  const { data, error } = await supabase.from("whatsapp_accounts")
    .select("id,business_id,phone_number_id,status").eq("phone_number_id", String(phoneNumberId)).maybeSingle();
  if (error) throw appError("db_error", 503);
  return data || null;
}

async function recordEvent(supabase, businessId, eventId, kind, payload) {
  // Idempotency: event_id is unique. A duplicate insert is treated as "already seen".
  const { data, error } = await supabase.from("webhook_events").insert({
    id: uuid(), business_id: businessId, event_id: String(eventId), kind, payload, processed: false, created_at: now(),
  }).select("id").maybeSingle();
  if (error) {
    const code = error.code || error.status;
    if (code === "23505" || /duplicate|unique/i.test(String(error.message))) return { duplicate: true };
    throw appError("db_error", 503);
  }
  return { duplicate: false, id: data?.id };
}

async function markProcessed(supabase, rowId) {
  if (!rowId) return;
  await supabase.from("webhook_events").update({ processed: true }).eq("id", rowId);
}

async function upsertCustomer(supabase, businessId, waId, profile) {
  const dedupeKey = `${businessId}:${waId}`;
  const { data: existing } = await supabase.from("customers").select("id,name,phone").eq("dedupe_key", dedupeKey).maybeSingle();
  if (existing) {
    const patch = {};
    if (profile?.name && !existing.name) patch.name = profile.name;
    if (Object.keys(patch).length) await supabase.from("customers").update({ ...patch, updated_at: now() }).eq("id", existing.id);
    return { ...existing, ...patch };
  }
  const row = {
    id: uuid(), business_id: businessId, dedupe_key: dedupeKey, wa_id: waId,
    name: profile?.name || null, phone: waId, email: null, created_at: now(), updated_at: now(),
  };
  const { data, error } = await supabase.from("customers").insert(row).select("id,name,phone").single();
  if (error) throw appError("db_error", 503);
  return data;
}

async function getOpenConversation(supabase, businessId, customerId) {
  const { data } = await supabase.from("conversations").select("*")
    .eq("business_id", businessId).eq("customer_id", customerId)
    .in("status", ["open", "human_handoff"]).order("last_message_at", { ascending: false }).limit(1);
  if (data && data.length) return data[0];
  const row = {
    id: uuid(), business_id: businessId, customer_id: customerId, status: "open", mode: "ai",
    tags: [], last_message: null, last_message_at: now(), unread: 0, created_at: now(), updated_at: now(),
  };
  const { data: created, error } = await supabase.from("conversations").insert(row).select("*").single();
  if (error) throw appError("db_error", 503);
  return created;
}

async function addMessage(supabase, { conversationId, businessId, direction, sender, body, status = "received" }) {
  const row = { id: uuid(), conversation_id: conversationId, business_id: businessId, direction, sender, body, status, created_at: now() };
  const { data, error } = await supabase.from("messages").insert(row).select("id,body,sender,direction,status,created_at").single();
  if (error) throw appError("db_error", 503);
  return data;
}

async function loadHistory(supabase, conversationId, limit = 12) {
  const { data } = await supabase.from("messages").select("sender,body").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(limit);
  return (data || []).reverse().map((m) => ({ role: m.sender === "customer" ? "user" : "assistant", content: m.body }));
}

async function getAiContext(supabase, businessId) {
  const [businessRes, configRes] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    supabase.from("ai_configs").select("*").eq("business_id", businessId).maybeSingle(),
  ]);
  if (businessRes.error) throw appError("db_error", 503);
  return { business: businessRes.data, aiConfig: configRes.data };
}

async function recordUsage(supabase, businessId, conversationId, intent, usage, mode) {
  await supabase.from("ai_interactions").insert({
    id: uuid(), business_id: businessId, conversation_id: conversationId, intent, mode,
    model: usage?.model || null, prompt_tokens: usage?.prompt_tokens || 0,
    completion_tokens: usage?.completion_tokens || 0, estimated_cost_micro: usage?.estimated_cost_micro || 0,
    created_at: now(),
  });
}

// Handle a verified inbound webhook body. Returns processing counts.
export async function handleInbound({ supabase, env, body }) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let received = 0, processed = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;

      // Delivery / read status updates.
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const st of statuses) {
        received++;
        const waMessageId = st?.id;
        if (!waMessageId) continue;
        const { data: msg } = await supabase.from("messages").select("id,conversation_id").eq("wa_message_id", waMessageId).maybeSingle();
        if (msg) await supabase.from("messages").update({ status: String(st.status || "sent") }).eq("id", msg.id);
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      for (const m of messages) {
        received++;
        const eventId = m?.id || `${phoneNumberId}:${Date.now()}:${Math.random()}`;
        const account = await findBusinessByPhoneNumber(supabase, phoneNumberId);
        const businessId = account?.business_id || null;
        const seen = await recordEvent(supabase, businessId, eventId, "message", { type: m?.type, from: m?.from });
        if (seen.duplicate) continue; // idempotent: already processed
        if (!businessId) { await markProcessed(supabase, seen.id); continue; } // no matching business

        const from = m?.from;
        if (!from) { await markProcessed(supabase, seen.id); continue; }
        const contact = contacts.find((c) => c?.wa_id === from);
        const text = m?.type === "text" ? (m?.text?.body || "") : `[${m?.type || "unsupported"} message]`;

        const customer = await upsertCustomer(supabase, businessId, from, { name: contact?.profile?.name });
        const conversation = await getOpenConversation(supabase, businessId, customer.id);
        await addMessage(supabase, { conversationId: conversation.id, businessId, direction: "inbound", sender: "customer", body: text });
        await supabase.from("conversations").update({
          last_message: text.slice(0, 500), last_message_at: now(),
          unread: (conversation.unread || 0) + 1, updated_at: now(),
        }).eq("id", conversation.id);

        // Human takeover suppresses the AI.
        if (conversation.mode === "human" || conversation.status === "human_handoff") {
          await markProcessed(supabase, seen.id); processed++; continue;
        }

        const { business, aiConfig } = await getAiContext(supabase, businessId);
        if (aiConfig && aiConfig.is_active === false) { await markProcessed(supabase, seen.id); processed++; continue; }
        const history = await loadHistory(supabase, conversation.id);
        let result;
        try {
          result = await runOrchestrator({ supabase, env, businessId, business, aiConfig, history, message: text, customer });
        } catch {
          await markProcessed(supabase, seen.id); processed++; continue; // AI failure must not crash processing
        }

        const outMsg = await addMessage(supabase, { conversationId: conversation.id, businessId, direction: "outbound", sender: "ai", body: result.reply, status: "pending" });
        await supabase.from("conversations").update({
          last_message: result.reply.slice(0, 500), last_message_at: now(), updated_at: now(),
          ...(result.handoff ? { mode: "human", status: "human_handoff" } : {}),
        }).eq("id", conversation.id);
        await recordUsage(supabase, businessId, conversation.id, result.intent, result.usage, result.mode);

        if (whatsappConfigured(env) && account?.phone_number_id) {
          const sent = await sendText(env, { phoneNumberId: account.phone_number_id, to: from, text: result.reply });
          await supabase.from("messages").update({ status: sent.ok ? "sent" : "failed", wa_message_id: sent.messageId || null }).eq("id", outMsg.id);
        }
        await markProcessed(supabase, seen.id);
        processed++;
      }
    }
  }
  return { received, processed };
}
