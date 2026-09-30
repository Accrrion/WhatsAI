# AI Engine

## Pipeline
`intent detection → context assembly → grounded retrieval → generation → validation →
safety/hallucination guards → sanitization → reply`

Implemented in `functions/ai/orchestrator.mjs`.

## Intents
product/price enquiry, availability, order request, delivery, return/refund, business hours,
location, complaint, human request, general, unknown. `detectIntent()` uses keyword
heuristics; the LLM path may refine via tools.

## Two modes
1. **LLM mode** (when `AI_API_KEY` set): OpenAI-compatible chat completions with tool
   calling, up to 3 rounds. Provider is swappable via `AI_BASE_URL` / `AI_MODEL` /
   `AI_PROVIDER`.
2. **Retrieval fallback** (no key, or LLM error): deterministic, fully grounded responses
   built from the business's real products/FAQs/policies/hours. Labeled `mode: "retrieval"`
   and surfaced in the UI as "AI: rule-based demo". This is honest — never presented as a
   live LLM.

## Tools (no unrestricted DB access)
`get_business_information`, `search_products`, `get_product_details`,
`check_product_availability`, `get_business_hours`, `get_delivery_information`,
`create_lead`, `update_customer`, `create_order`, `get_order_status`,
`request_human_handoff`. Each is tenant-scoped and returns only grounded data.
`search_products` tokenizes (strips punctuation/stopwords, min length 3) with a score
threshold so it does not match unrelated items.

## Grounding rules (enforced in prompt + retrieval)
- Never invent prices, stock, delivery times or policies.
- Never claim an order was placed or payment succeeded unless the backend confirms.
- Clearly say when it doesn't know; escalate when necessary.
- Fallback line: *"Let me connect you with a member of our team who can help with that."*
- Style: friendly, professional, concise, natural; tone/language/length configurable.

## Prompt-injection defense
System prompt frames business knowledge and customer messages as **untrusted data**, never
instructions. The model is told never to reveal API keys, system prompts, credentials,
internal tool names, or other customers'/businesses' data. `sanitizeReply()` redacts secret
patterns before any reply leaves the Function.

## Human handoff
If a conversation's `mode === 'human'`, `status === 'human_handoff'`, or the assistant
`is_active === false`, the AI stays silent and the webhook skips generation. The owner
reactivates from the inbox ("Return to AI").

## Cost tracking
`estimateCostMicro(usage)` records prompt/completion tokens and estimated micro-USD per
interaction in `ai_interactions`; surfaced in Analytics.
