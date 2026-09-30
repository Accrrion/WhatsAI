# WhatsAI — Implementation Report (Cloudflare target)

> Temporary product name. The brand is centralized in `lib/config.ts` (`BRAND`) and is not
> hard-coded across the app — rename it there to rebrand.

This report states plainly what is built, what must change for Cloudflare, what remains, where
to configure credentials, and how to test. No integration is presented as working when its
credentials or porting step are missing.

## 1. Overview & status

An AI WhatsApp Business assistant SaaS for Nigerian SMEs. Multi-tenant: each owner's data is
scoped to their authenticated identity. **Status: MVP feature-complete in code against the
Qoder runtime; local build + 36/36 backend tests green. The Cloudflare deployment requires the
backend port in [`PORTING.md`](PORTING.md) — not yet performed.**

## 2. Tech stack (Cloudflare target)

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind v4, Shadcn UI, recharts, sonner,
  lucide-react. Static output to `dist/`, served by a Worker's Static Assets binding (or Pages).
- **Backend:** ONE Cloudflare **Worker** (V8 isolate) at `src/worker.ts`, routing the existing
  `functions/` action handlers. Replaces the Qoder Deno Function.
- **Database:** **Your own** Postgres (Supabase or Neon) via `@supabase/supabase-js`, with
  **row-level security** enabled.
- **AI:** provider-agnostic OpenAI-compatible chat-completions client with tool calling, plus a
  deterministic grounded-retrieval fallback.
- **WhatsApp:** Meta WhatsApp Business Platform (Cloud API), Graph API v21.0. Official API only.

## 3. Architecture

Browser → same-origin `/functions/v1/app?action=...` → Worker `fetch` → action router
(`functions/handler.mjs`) → tenant-scoped handlers (`functions/routes.mjs`) → Postgres. The AI
orchestrator and WhatsApp webhook run server-side only. Secrets never reach the browser. See
[`ARCHITECTURE.md`](ARCHITECTURE.md).

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
- Labeled in-browser **demo adapter** so a frontend-only deploy is explorable without a Worker.
- Seed data: "Paul's Fashion Store".

## 5. Must change for Cloudflare (porting work — not yet done)

- **Runtime:** `functions/index.ts` (`Deno.serve`) → a Worker `fetch` handler (PORTING §1).
- **Adapter:** `functions/adapter.mjs` (`serveSite`, `x-instance-id` gate, injected Supabase
  env) is Qoder-only and must be **replaced**, not ported (PORTING §2).
- **Env:** `functions/handler.mjs` line 9 `Deno.env.get` → Worker `env` binding threaded per
  request (PORTING §3).
- **Identity:** `functions/auth.mjs` trusts the gateway `x-qoder-user-context` header, which does
  not exist on Cloudflare. Rewrite `requireUser()` to verify **your own** identity (Cloudflare
  Access JWT / Supabase Auth / session). **Highest-priority porting task** (PORTING §4).
- **Dependency:** `npm:@supabase/supabase-js@2.57.4` Deno specifier → normal npm dependency
  bundled by Wrangler (PORTING §5).

## 6. Behavior depends on credentials

- **Live LLM responses:** run only when `AI_API_KEY` is set; otherwise the grounded rule-based
  retrieval engine (clearly labeled "AI: rule-based demo").
- **WhatsApp delivery:** outbound sends require `META_ACCESS_TOKEN`; without it inbound messages
  are still processed/stored and replied to in-app, but not delivered.
- **Webhook signature verification:** active only when `META_APP_SECRET` is set.

## 7. Not built (future phases per spec)

- Payments (Paystack/Flutterwave) — abstraction planned, not wired.
- Bookings, staff accounts, multi-number per business, team roles beyond OWNER.
- Media (image/audio) WhatsApp messages — text only in this release.
- Frontend code-splitting (bundle >500 kB).

## 8. Multi-tenancy & isolation (improved on Cloudflare)

Every query is scoped by `owner_user_id` / `business_id` derived from the **Worker-verified**
identity — never from frontend input. Unlike the Qoder deployment (anonymous adapter, no RLS
owner policies), on Cloudflare you own the Postgres and **should enable real RLS** with owner
policies so isolation is database-enforced, not application-only (DATABASE.md §Row-level
security, SECURITY.md §Isolation). Keep the existing application-level isolation tests and add
an RLS-level cross-tenant test.

## 9. AI grounding rules (enforced in prompts + retrieval)

Never invents prices, stock, delivery times or policies; never claims an order/payment succeeded
unless the backend confirms; says when it doesn't know; escalates when needed. Fallback line:
*"Let me connect you with a member of our team who can help with that."* Business knowledge and
customer messages are treated as untrusted; replies are sanitized to redact secrets, system
prompts, credentials and internal tool names.

## 10. Required credentials & where to configure

Set as **Worker secrets** (`wrangler secret put …`; local dev in `.dev.vars`). Never in Git,
never in the frontend, never as `VITE_*`:

| Secret | Purpose | Required for |
| --- | --- | --- |
| `SUPABASE_URL` | Postgres/PostgREST endpoint | All persistence |
| `SUPABASE_SERVICE_ROLE_KEY` *or* `SUPABASE_ANON_KEY` | DB access (service-role vs RLS model) | All persistence |
| `AI_API_KEY` | LLM provider key | Live AI responses |
| `AI_BASE_URL` | OpenAI-compatible endpoint | Custom provider |
| `AI_MODEL` | Model name (default `gpt-4o-mini`) | Live AI responses |
| `AI_PROVIDER` | Provider label (optional) | Analytics/labeling |
| `META_ACCESS_TOKEN` | WhatsApp Cloud API token | Sending messages |
| `META_APP_SECRET` | Webhook signature validation | Secure webhooks |
| `META_VERIFY_TOKEN` | Webhook GET handshake | Connecting webhook |
| `META_APP_ID` | Meta app reference | Webhook config |
| `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_KEY` | Future payments | Not yet used |

## 11. Security measures

Worker-verified identity (your auth); server-only secrets; **database RLS**; HMAC webhook
verification; idempotent webhook processing; input validation/length caps; parameterized DB
access; application-enforced tenant scoping; AI output sanitization; prompt-injection defenses.
Edge concerns you now own: TLS (automatic), rate limiting, WAF, CORS, and CSRF for session auth.

## 12. How to run locally

```sh
# Node 22.12+ (22.x)
npm ci
npm run build              # → dist/
npx wrangler dev           # Worker + static assets on http://127.0.0.1:8787 (secrets from .dev.vars)
node dev/run-local.mjs     # backend logic harness (in-memory Supabase fake) — 36 assertions
```
`dev/run-local.mjs` validates handler/route logic under Node independent of the Worker runtime.

## 13. How to test the main flow

`dev/run-local.mjs` covers: auth, onboarding, seed, knowledge CRUD, AI config, AI sandbox
grounding (including "never invents a nonexistent product price"), conversations + human handoff,
leads/orders/analytics, tenancy isolation, and WhatsApp webhook idempotency. Current result:
**36 passed, 0 failed.** After the port, re-run against the deployed Worker + real Postgres and
add RLS cross-tenant checks.

## 14. How to deploy

See [`DEPLOYMENT.md`](DEPLOYMENT.md): provision Postgres → port + deploy the Worker → build and
serve `dist/` → set secrets → attach a custom domain → wire the public WhatsApp webhook →
verify end to end on the live domain.

## 15. Known limitations & next steps

- The Cloudflare backend port (PORTING.md) is **not yet implemented**; until then the app runs
  on the labeled demo adapter when deployed frontend-only.
- Identity must be provided by you (Access/Auth/session) — no gateway-injected context.
- Text-only WhatsApp; single business per owner; single number per business.
- Payments/bookings/staff are future phases. Bundle >500 kB (no code-splitting yet).
