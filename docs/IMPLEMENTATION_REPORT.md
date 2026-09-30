# WhatsAI — Implementation Report

> Temporary product name. The brand is centralized in `lib/config.ts` (`BRAND`) and is
> not hard-coded across the app — rename it there to rebrand.

This report states plainly what is built, what is stubbed, what remains, where to
configure credentials, and how to test. No integration is presented as working when
its credentials are missing.

## 1. Overview & status
An AI WhatsApp Business assistant SaaS for Nigerian SMEs. Multi-tenant: each owner's
data is scoped to their authenticated identity. **Status: MVP feature-complete in code;
local build + backend tests green; not yet deployed to cloud.**

## 2. Tech stack
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind v4, Shadcn UI catalog, recharts, sonner, lucide-react. Static output to `dist/`.
- **Backend:** ONE Qoder Sites Edge Function (Deno) at `functions/`, deployed as the `app` function.
- **Database:** Supabase Postgres via the bundled anonymous adapter (`@supabase/supabase-js@2.57.4`).
- **AI:** Provider-agnostic OpenAI-compatible chat-completions client with tool calling, plus a deterministic grounded-retrieval fallback.
- **WhatsApp:** Meta WhatsApp Business Platform (Cloud API), Graph API v21.0. Official API only — no unofficial automation.

## 3. Architecture
Browser → same-origin `/functions/v1/app?action=...` → Edge Function router
(`functions/handler.mjs`) → tenant-scoped handlers (`functions/routes.mjs`) →
Supabase. The AI orchestrator (`functions/ai/orchestrator.mjs`) and WhatsApp webhook
(`functions/whatsapp/webhook.mjs`) run server-side only. Secrets never reach the browser.

## 4. Fully implemented (code-complete, locally verified)
- Auth-derived tenancy, business profile, onboarding wizard (11 steps).
- Knowledge base: products, services, FAQs, policies, opening hours (CRUD).
- AI config (persona, tone, language, length, handoff behavior, welcome/fallback).
- AI orchestration: intent detection → grounded retrieval → generation → validation →
  safety/hallucination guards → sanitization. 11 tools (no unrestricted DB access).
- Conversation inbox: list, thread, reply, **human handoff** (take over / return to AI /
  resolve), tags, internal notes.
- Leads, orders, customers, analytics (30d totals, intents, 14-day series).
- WhatsApp webhook: GET verify handshake, POST inbound, HMAC-SHA256 signature check,
  idempotency via unique `event_id`, delivery/read status handling.
- Test assistant sandbox showing reply, intent, mode and sources used.
- Labeled in-browser **demo adapter** so the static preview is explorable without a Function.
- Seed data: "Paul's Fashion Store" (3 products, FAQs, policies, hours, sample
  customers/conversations/leads/orders).

## 5. Partially implemented / behavior depends on credentials
- **Live LLM responses:** implemented, but run only when `AI_API_KEY` is set. Without it
  the system uses the grounded rule-based retrieval engine (clearly labeled "AI: rule-based demo").
- **WhatsApp message delivery:** implemented, but outbound sends require `META_ACCESS_TOKEN`.
  Without it, inbound messages are still processed/stored and replied to in-app, but not
  delivered to WhatsApp.
- **Webhook signature verification:** active only when `META_APP_SECRET` is set.

## 6. Not built (future phases per spec)
- Payments (Paystack/Flutterwave) — abstraction planned, not wired.
- Bookings, staff accounts, multi-number per business, team roles beyond OWNER.
- Production rate limiting, CSRF token issuance (platform gateway handles auth/CSRF at ingress).
- Media (image/audio) WhatsApp messages — text only in this release.

## 7. Multi-tenancy & isolation (IMPORTANT limitation)
Every query is scoped by `owner_user_id` / `business_id` derived from the gateway-verified
`x-qoder-user-context` header — **never** from frontend input. The anonymous Supabase
adapter cannot enforce row-level `auth.uid()` owner policies, so database-level RLS owner
isolation is **not** achievable here; tenancy is **application-enforced** and verified by
the isolation tests in `dev/run-local.mjs`. This is a deliberate, documented scope decision
that requires explicit acceptance before production use.

## 8. AI grounding rules (enforced in prompts + retrieval)
Never invents prices, stock, delivery times or policies; never claims an order/payment
succeeded unless the backend confirms; says when it doesn't know; escalates when needed.
Fallback line: *"Let me connect you with a member of our team who can help with that."*
Business knowledge and customer messages are treated as untrusted; replies are sanitized
to redact secrets, system prompts, credentials and internal tool names.

## 9. Required credentials & where to configure
Enter these as **Secrets in Qoder Sites → Settings** (never in Git, never in frontend):
| Secret | Purpose | Required for |
| --- | --- | --- |
| `AI_API_KEY` | LLM provider key | Live AI responses |
| `AI_BASE_URL` | OpenAI-compatible endpoint (default `https://api.openai.com/v1`) | Custom provider |
| `AI_MODEL` | Model name (default `gpt-4o-mini`) | Live AI responses |
| `AI_PROVIDER` | Provider label (optional) | Analytics/labeling |
| `META_ACCESS_TOKEN` | WhatsApp Cloud API token | Sending messages |
| `META_APP_SECRET` | Webhook signature validation | Secure webhooks |
| `META_VERIFY_TOKEN` | Webhook GET handshake | Connecting webhook |
| `META_APP_ID` | Meta app reference | Webhook config |
| `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_KEY` | Future payments | Not yet used |

Reserved prefixes (not allowed): `QODER_`, `SUPABASE_`, `POSTGRES_`, `DATABASE_URL`.

## 10. Security measures
Gateway-verified identity; server-only secret access; HMAC webhook verification;
idempotent webhook processing; input validation/length caps; parameterized DB access via
the Supabase client (no string-built SQL); application-enforced tenant scoping; AI output
sanitization; prompt-injection defenses (untrusted-data framing, no secret disclosure).

## 11. How to run locally
```sh
# Node 22.12+ in the 22.x series
npm ci
npm run dev          # frontend on loopback
node dev/run-local.mjs   # backend harness (in-memory Supabase fake) — 36 assertions
npm run build && npm run preview
```
No Deno or cloud account needed for the above. `dev/function-local.ts` is an optional
Deno server for the real Function.

## 12. How to test the main flow
`dev/run-local.mjs` covers: auth, onboarding, seed, knowledge CRUD, AI config, AI sandbox
grounding (including "never invents a nonexistent product price"), conversations + human
handoff, leads/orders/analytics, tenancy isolation, and WhatsApp webhook idempotency.
Current result: **36 passed, 0 failed.**

## 13. How to deploy
See `docs/DEPLOYMENT.md`. Requires user authorization to enable the Functions + Database
backends, apply the schema migration, and accept the isolation scope (§7).

## 14. Known limitations & next steps
- DB-level RLS owner isolation unavailable with the anonymous adapter (§7).
- Text-only WhatsApp; no media handling yet.
- Single business per owner; single WhatsApp number per business.
- Payments/bookings/staff are future phases.
- Bundle is >500 kB (no code-splitting yet) — acceptable for MVP, optimize later.
