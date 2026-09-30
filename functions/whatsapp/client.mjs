// Meta WhatsApp Cloud API client. Uses the official Graph API only.
// Credentials come from application Secrets (server-side); never from the browser.
// Per-business sender is identified by whatsapp_accounts.phone_number_id.
const GRAPH_VERSION = "v21.0";

export function whatsappConfigured(env) {
  const token = env("META_ACCESS_TOKEN");
  return Boolean(token && token.trim());
}

export async function sendText(env, { phoneNumberId, to, text }) {
  const token = env("META_ACCESS_TOKEN");
  if (!token || !token.trim()) return { ok: false, error: "whatsapp_not_configured" };
  if (!phoneNumberId || !to) return { ok: false, error: "missing_destination" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: String(text).slice(0, 4096) },
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: "whatsapp_send_failed", status: res.status };
    return { ok: true, messageId: data?.messages?.[0]?.id || null };
  } catch (e) {
    return { ok: false, error: "whatsapp_unreachable", detail: e?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

// Verify a webhook signature (X-Hub-Signature-256) against META_APP_SECRET.
export async function verifySignature(env, rawBody, signatureHeader) {
  const secret = env("META_APP_SECRET");
  if (!secret || !secret.trim()) return { verified: false, reason: "no_app_secret" };
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return { verified: false, reason: "missing_signature" };
  const provided = signatureHeader.slice("sha256=".length).trim();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time-ish comparison.
  if (computed.length !== provided.length) return { verified: false, reason: "mismatch" };
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0 ? { verified: true } : { verified: false, reason: "mismatch" };
}
