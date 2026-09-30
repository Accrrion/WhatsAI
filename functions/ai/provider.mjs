// AI provider abstraction. The application is not coupled to one vendor: any
// OpenAI-compatible chat-completions endpoint works by setting AI_BASE_URL,
// AI_API_KEY and AI_MODEL as application Secrets. When no key is configured the
// orchestrator falls back to a deterministic, fully grounded retrieval responder
// so the product still works end-to-end (clearly labeled as demo mode).

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function resolveAiConfig(env) {
  const apiKey = env("AI_API_KEY");
  const baseRaw = env("AI_BASE_URL") || DEFAULT_BASE;
  const model = env("AI_MODEL") || DEFAULT_MODEL;
  let base = DEFAULT_BASE;
  try {
    const u = new URL(baseRaw);
    if (u.protocol === "https:" || u.protocol === "http:") base = baseRaw.replace(/\/$/, "");
  } catch { /* keep default */ }
  const provider = env("AI_PROVIDER") || (apiKey ? "openai-compatible" : "retrieval-fallback");
  return { configured: Boolean(apiKey && apiKey.trim()), apiKey: apiKey || "", base, model, provider };
}

// One chat-completions round. Returns { content, toolCalls, usage }.
export async function chat(env, { messages, tools, temperature = 0.4, maxTokens = 500, timeoutMs = 20000 }) {
  const cfg = resolveAiConfig(env);
  if (!cfg.configured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = { model: cfg.model, messages, temperature, max_tokens: maxTokens };
    if (tools && tools.length) { body.tools = tools; body.tool_choice = "auto"; }
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: "ai_provider_error", status: res.status, detail: text.slice(0, 200) };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const msg = choice?.message || {};
    const usage = data?.usage || {};
    return {
      content: typeof msg.content === "string" ? msg.content : "",
      toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
      usage: {
        prompt_tokens: Number(usage.prompt_tokens) || 0,
        completion_tokens: Number(usage.completion_tokens) || 0,
        model: cfg.model,
      },
    };
  } catch (e) {
    return { error: "ai_provider_unreachable", detail: e?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export function estimateCostMicro(usage) {
  // Rough USD-micro (1e-6 USD) estimate for a small model; billing is not final.
  const input = (usage?.prompt_tokens || 0) * 0.15; // per 1k tokens -> micro
  const output = (usage?.completion_tokens || 0) * 0.6;
  return Math.round((input + output) * 1000);
}
