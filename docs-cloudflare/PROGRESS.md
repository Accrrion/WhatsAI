# Progress & TODO — Cloudflare deployment

Living tracker for taking WhatsAI live on **Cloudflare**. Mirrors the root `PROGRESS.md`
(which tracks the Qoder build) but scoped to the Cloudflare port. Update as steps complete.

## Completed (application code — runtime-agnostic)

- [x] Phase 0 — Discovery, stack choice, scaffold (React 19 + Vite 8 + Tailwind v4 + Shadcn).
- [x] Brand theme, central `BRAND` config, money/date helpers.
- [x] Database schema — 17 tables (`docs-cloudflare/schema.sql`).
- [x] Backend handlers — router, ~40 tenant-scoped actions, validators, tenancy helpers.
- [x] AI engine — provider abstraction, prompts, orchestrator, 11 tools, grounded retrieval
      fallback, sanitization.
- [x] WhatsApp — Cloud API client, webhook verify + inbound, HMAC signature, idempotency,
      status handling.
- [x] Seed data — Paul's Fashion Store.
- [x] Frontend API layer with labeled demo fallback; app store; sidebar shell.
- [x] Landing page (11 conversion sections).
- [x] Dashboard pages: Overview, Conversations inbox, Customers, Leads, Products, Orders,
      Knowledge base, Test Assistant, WhatsApp, Analytics, Settings, Onboarding (11 steps).
- [x] Local backend harness — **36/36 passing**; `npm run build` green.
- [x] Cloudflare documentation set (this folder).

## TODO — Cloudflare port (see `PORTING.md`)

- [ ] Worker entry (`src/worker.ts`) replaces `functions/index.ts` (`Deno.serve`/`serveSite`).
- [ ] Do **not** deploy `functions/adapter.mjs`; build the Supabase client from Worker secrets.
- [ ] `functions/handler.mjs`: thread `env` from the request context (remove `Deno.env.get`).
- [ ] `functions/auth.mjs`: rewrite `requireUser()` to verify **your** identity
      (Cloudflare Access JWT / Supabase Auth / session). *(Highest priority — tenancy depends on it.)*
- [ ] Add `@supabase/supabase-js` as a normal npm dependency (drop the `npm:` Deno specifier).
- [ ] Route `/functions/v1/app` to the Worker; configure SPA fallback (`not_found_handling`).

## TODO — Cloudflare infrastructure (see `DEPLOYMENT.md`)

- [ ] `npx wrangler login`; install `wrangler` as a dev dependency.
- [ ] Provision Postgres (Supabase or Neon); apply `schema.sql`.
- [ ] **Enable RLS** with owner policies (recommended) — removes the Qoder isolation limitation.
- [ ] Add `wrangler.jsonc` (Worker + Static Assets binding to `dist/`).
- [ ] `wrangler secret put` for: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`),
      `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `META_ACCESS_TOKEN`, `META_APP_SECRET`,
      `META_VERIFY_TOKEN`, `META_APP_ID`.
- [ ] `npm run build` → `wrangler deploy`.
- [ ] Attach a **custom domain** (Worker or Pages) — the capability Qoder does not offer.
- [ ] Configure **Cloudflare Access** (or your IdP) for the dashboard; **exclude the webhook path**.
- [ ] Add edge **rate limiting** on `/functions/v1/app` and the webhook path.
- [ ] Set the Meta callback URL to `https://yourdomain.com/functions/v1/app?action=whatsapp.webhook`
      and subscribe to `messages`.

## TODO — verification

- [ ] `wrangler dev` locally: sign in → dashboard → add product → test assistant → connect
      WhatsApp → inbound test → inbox → take over → capture lead → analytics.
- [ ] Re-run `dev/run-local.mjs` (36 assertions) after the port for logic regressions.
- [ ] Add an **RLS cross-tenant test** (query as tenant A for tenant B's rows → expect 0).
- [ ] Deploy and re-verify the full flow on the live custom domain.
- [ ] Record build success, deploy success, and real integration behavior **separately**.

## TODO — future phases (post-launch)

- [ ] Payments (Paystack/Flutterwave) abstraction + webhook.
- [ ] Bookings, staff accounts, team roles (ADMIN/AGENT), multi-number.
- [ ] WhatsApp media messages (image/audio/document).
- [ ] Production observability: structured Worker logging (no secrets), error tracking, audit UI.
- [ ] Frontend code-splitting to reduce bundle size (<500 kB).
- [ ] Nigerian language coverage beyond config options (Pidgin/Yoruba/Igbo/Hausa) validation.

## MVP acceptance (per spec)

Register → create business → add products → add info → configure AI → connect WhatsApp
(official Meta) → receive/process customer message → grounded answer → send back → view in
dashboard → take over → capture lead → view analytics. **All flows implemented in code;
Cloudflare delivery pending the backend port + infrastructure steps above.**

## Guiding constraints (unchanged)

- Official Meta WhatsApp API only.
- AI never fabricates prices/stock/policies/order or payment status.
- Tenant isolation derived from verified identity, never client input — enforced by RLS.
- Secrets server-side only (Worker secrets / `.dev.vars`); never in Git or the frontend.
- No fake integrations — clearly mark what is implemented vs. pending credentials/porting.
