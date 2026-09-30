# WhatsAI — AI WhatsApp Business Assistant

> Temporary name. The brand lives in `lib/config.ts` (`BRAND`) — change it there to rebrand.

WhatsAI lets Nigerian SMEs connect an official WhatsApp Business number and deploy an AI
assistant that answers customers from the business's **real** products, prices, FAQs,
policies and hours — captures leads, hands conversations to a human when needed, and tracks
everything in a dashboard.

It never invents prices, stock, delivery times or policies, and never claims an order or
payment succeeded unless the backend confirms it.

## Stack
- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind v4 + Shadcn UI. Static build → `dist/`.
- **Backend:** ONE Qoder Sites Edge Function (Deno) in `functions/`.
- **Database:** Supabase Postgres (16 tables, `docs/schema.sql`).
- **AI:** provider-agnostic OpenAI-compatible client with tool calling + grounded retrieval fallback.
- **WhatsApp:** official Meta WhatsApp Business Platform (Cloud API), Graph API v21.0.

## Quick start (local, no cloud needed)
Requires Node **22.12+ in the 22.x series**.
```sh
npm ci
npm run dev               # frontend on the loopback URL Vite prints
node dev/run-local.mjs    # backend harness (in-memory Supabase fake) — 36 assertions
npm run build && npm run preview
```
Without a Function/backend the UI transparently falls back to a **labeled in-memory demo**
("Demo data" badge) so the product is fully explorable. This is never presented as live data.

## Project layout
```
functions/        Edge Function: handler.mjs (router), routes.mjs, ai/, whatsapp/, db.mjs, seed.mjs
src/              App entry: main.tsx, App.tsx, globals.css
components/       Landing.tsx, app/ (AppShell, shared, pages/*), ui/ (Shadcn catalog)
lib/              config.ts (BRAND, helpers), utils.ts (cn)
api.ts            browser API layer + demo adapter
store.tsx         app context (bootstrap, mode, routing)
hooks/            use-mobile, etc.
dev/              run-local.mjs (test harness), fake-supabase.mjs, function-local.ts (Deno)
docs/             schema.sql, ARCHITECTURE, DATABASE, API, AI, WHATSAPP, SECURITY, DEPLOYMENT, ROADMAP, IMPLEMENTATION_REPORT
```
Alias: `@/*` → project root.

## Configuration (Secrets — enter in Qoder Sites → Settings, never in Git/frontend)
| Secret | Enables |
| --- | --- |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER` | Live LLM responses (else grounded rule-based fallback) |
| `META_ACCESS_TOKEN` | Sending WhatsApp messages |
| `META_APP_SECRET` | Webhook signature verification |
| `META_VERIFY_TOKEN`, `META_APP_ID` | Webhook handshake/config |
| `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY` | Future payments (not yet used) |

## Deploy
See `docs/DEPLOYMENT.md`. Cloud deployment requires authorization to enable the Functions +
Database backends, apply the migration, accept the tenancy/isolation scope, and enter Secrets.

## Status & docs
- Implementation report: `docs/IMPLEMENTATION_REPORT.md`
- Progress/TODO: `PROGRESS.md`
- Security & isolation limitation: `docs/SECURITY.md`

Built on the Qoder Sites React starter — see `PROVENANCE.md` and `vendor/` for attribution.
