// Single deployed Function entry logic. Routes by the `action` query parameter.
// Public: whatsapp.webhook (Meta server-to-server). Everything else requires the
// Gateway-verified Qoder user context (tenant identity).
import { requireUser, UserContextError, fail, ok } from "./db.mjs";
import { verifySignature } from "./whatsapp/client.mjs";
import { handleInbound } from "./whatsapp/webhook.mjs";
import * as R from "./routes.mjs";

const env = (name) => Deno.env.get(name);

// action -> { fn, methods }
const REGISTRY = {
  "me": { fn: R.me, methods: ["GET"] },
  "bootstrap": { fn: R.bootstrap, methods: ["GET"] },
  "seed": { fn: R.seed, methods: ["POST"] },

  "business.save": { fn: R.businessSave, methods: ["POST"] },
  "hours.get": { fn: R.hoursGet, methods: ["GET"] },
  "hours.set": { fn: R.hoursSet, methods: ["POST"] },
  "policies.save": { fn: R.policiesSave, methods: ["POST"] },
  "policies.get": { fn: R.policiesGet, methods: ["GET"] },

  "products.list": { fn: R.productsList, methods: ["GET"] },
  "products.create": { fn: R.productsCreate, methods: ["POST"] },
  "products.update": { fn: R.productsUpdate, methods: ["POST"] },
  "products.delete": { fn: R.productsDelete, methods: ["POST"] },
  "services.list": { fn: R.servicesList, methods: ["GET"] },
  "services.save": { fn: R.servicesSave, methods: ["POST"] },
  "services.delete": { fn: R.servicesDelete, methods: ["POST"] },
  "faqs.list": { fn: R.faqsList, methods: ["GET"] },
  "faqs.save": { fn: R.faqsSave, methods: ["POST"] },
  "faqs.delete": { fn: R.faqsDelete, methods: ["POST"] },

  "aiConfig.get": { fn: R.aiConfigGet, methods: ["GET"] },
  "aiConfig.save": { fn: R.aiConfigSave, methods: ["POST"] },
  "ai.test": { fn: R.aiTest, methods: ["POST"] },

  "whatsapp.get": { fn: R.whatsappGet, methods: ["GET"] },
  "whatsapp.save": { fn: R.whatsappSave, methods: ["POST"] },
  "whatsapp.test": { fn: R.whatsappTest, methods: ["POST"] },

  "customers.list": { fn: R.customersList, methods: ["GET"] },
  "conversations.list": { fn: R.conversationsList, methods: ["GET"] },
  "conversations.get": { fn: R.conversationsGet, methods: ["GET"] },
  "conversations.reply": { fn: R.conversationsReply, methods: ["POST"] },
  "conversations.takeover": { fn: R.conversationsTakeover, methods: ["POST"] },
  "conversations.returnToAi": { fn: R.conversationsReturnToAi, methods: ["POST"] },
  "conversations.resolve": { fn: R.conversationsResolve, methods: ["POST"] },
  "conversations.tag": { fn: R.conversationsTag, methods: ["POST"] },
  "conversations.note": { fn: R.conversationsNote, methods: ["POST"] },

  "leads.list": { fn: R.leadsList, methods: ["GET"] },
  "leads.save": { fn: R.leadsSave, methods: ["POST"] },
  "leads.delete": { fn: R.leadsDelete, methods: ["POST"] },

  "orders.list": { fn: R.ordersList, methods: ["GET"] },
  "orders.save": { fn: R.ordersSave, methods: ["POST"] },

  "analytics": { fn: R.analytics, methods: ["GET"] },
};

const PUBLIC_ACTIONS = new Set(["whatsapp.webhook"]);

async function handleWebhook(request, supabase) {
  const url = new URL(request.url);
  // GET: Meta webhook verification handshake.
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = env("META_VERIFY_TOKEN");
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    }
    return new Response("forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }
  if (request.method !== "POST") return fail("method_not_allowed", 405);

  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > 512 * 1024) return fail("invalid_body", 400);
  // Verify signature when an app secret is configured.
  const signature = request.headers.get("x-hub-signature-256");
  if (env("META_APP_SECRET")) {
    const result = await verifySignature(env, raw, signature);
    if (!result.verified) return fail("invalid_signature", 401);
  }
  let body;
  try { body = JSON.parse(raw); } catch { return fail("invalid_body", 400); }
  try {
    const counts = await handleInbound({ supabase, env, body });
    // Always 200 quickly so Meta does not retry storms; processing errors are contained.
    return Response.json({ ok: true, ...counts }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: true, received: 0, processed: 0 }, { headers: { "cache-control": "no-store" } });
  }
}

export async function handle({ request, supabase }) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  if (!action) return fail("missing_action", 400);

  if (action === "whatsapp.webhook") return handleWebhook(request, supabase);

  const entry = REGISTRY[action];
  if (!entry) return fail("unknown_action", 404);
  if (!entry.methods.includes(request.method)) {
    return fail("method_not_allowed", 405, { });
  }

  let user;
  try {
    user = requireUser(request);
  } catch (e) {
    if (e instanceof UserContextError) return fail(e.code, e.status);
    return fail("login_required", 401);
  }

  try {
    return await entry.fn({ request, supabase, env, user, url, method: request.method });
  } catch (e) {
    if (e instanceof UserContextError) return fail(e.code, e.status);
    if (e && e.appError) return fail(e.appError, e.status || 400, e.hint ? { hint: e.hint } : {});
    return fail("service_unavailable", 503);
  }
}
