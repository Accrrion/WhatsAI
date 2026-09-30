# AI Engine — Cloudflare target

The AI logic is **identical** to the Qoder deployment; only how it reads configuration changes
(Worker `env` binding instead of `Deno.env`). See PORTING §1/§3 for the env threading.

## Pipeline

`intent detection → context assembly → grounded retrieval → generation → validation →
safety/hallucination guards → sanitization → reply`

Implemented in `functions/ai/orchestrator.mjs`.

## Intents

product/price enquiry, availability, order request, delivery, return/refund, business hours,
location, complaint, human request, general, unknown. `detectIntent()` uses keyword heuristics;
the LLM path may refine via tools.

## Two modes

1. **LLM mode** (when `AI_API_KEY` set): OpenAI-compatible chat completions with tool calling,
   up to 3 rounds. Provider is swappable via `AI_BASE_URL` / `AI_MODEL` / `AI_PROVIDER`.
   The outbound `fetch` to the provider runs from the Worker — standard Web `fetch`, no change.
2. **Retrieval fallback** (no key, or LLM error): deterministic, fully grounded responses built
   from the business's real products/FAQs/policies/hours. Labeled `mode: "retrieval"` and
   surfaced in the UI as "AI: rule-based demo". Honest — never presented as a live LLM.

## Tools (no unrestricted DB access)

`get_business_information`, `search_products`, `get_product_details`, `check_product_availability`,
`get_business_hours`, `get_delivery_information`, `create_lead`, `update_customer`,
`create_order`, `get_order_status`, `request_human_handoff`. Each is tenant-scoped and returns
only grounded data. `search_products` tokenizes (strips punctuation/stopwords, min length 3)
with a score threshold so it does not match unrelated items.

## Grounding rules (enforced in prompt + retrieval)

- Never invent prices, stock, delivery times or policies.
- Never claim an order was placed or payment succeeded unless the backend confirms.
- Clearly say when it doesn't know; escalate when necessary.
- Fallback line: *"Let me connect you with a member of our team who can help with that."*
- Style: friendly, professional, concise, natural; tone/language/length configurable.

## Prompt-injection defense

System prompt frames business knowledge and customer messages as **untrusted data**, never
instructions. The model is told never to reveal API keys, system prompts, credentials, internal
tool names, or other customers'/businesses' data. `sanitizeReply()` redacts secret patterns
before any reply leaves the Worker.

## Human handoff

If a conversation's `mode === 'human'`, `status === 'human_handoff'`, or the assistant
`is_active === false`, the AI stays silent and the webhook skips generation. The owner
reactivates from the inbox ("Return to AI").

## Cost tracking

`estimateCostMicro(usage)` records prompt/completion tokens and estimated micro-USD per
interaction in `ai_interactions`; surfaced in Analytics.

## Cloudflare runtime notes

- **CPU limits:** the multi-round tool loop must stay within Worker CPU limits. It already caps
  rounds at 3; if you raise that, watch the per-request budget. On a paid plan the limits are
  generous, but keep an eye on cold-start + provider latency.
- **Streaming:** if you later stream tokens to the browser, use a Worker `ReadableStream`
  response; the current implementation returns a single JSON reply.
- **Secrets:** `AI_API_KEY` etc. are Worker secrets — never bundled into the SPA.
- **Egress:** calls to the LLM provider and to Meta originate from Cloudflare IPs; if a provider
  IP-allowlists you, use Cloudflare's published ranges.
