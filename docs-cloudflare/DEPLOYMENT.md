# Deployment — Cloudflare

Target: the WhatsAI React SPA on **Cloudflare** with a **Worker** backend, your own
**Postgres** (Supabase or Neon), and an optional **custom domain**.

Two deployment shapes:
- **Frontend-only (fast, demo data).** Pages/Worker serves `dist/`; with no backend the UI
  falls back to the labeled in-browser demo. Good for a public marketing/demo site.
- **Full stack (real SaaS).** Worker backend + Postgres + your own auth. Requires the code
  port in [`PORTING.md`](PORTING.md). This guide covers the full stack.

---

## 0. Prerequisites

- A Cloudflare account (Workers/Pages) and `wrangler` authenticated: `npx wrangler login`.
- Node **22.12+ (22.x)** for the frontend build.
- A Postgres provider: **Supabase** (easiest — supabase-js talks to it over HTTP/PostgREST)
  or **Neon** (use `@neondatabase/serverless` + a driver, or Hyperdrive).
- Completed the code port in [`PORTING.md`](PORTING.md) (Worker entry, rewritten `auth.mjs`,
  env threading, dependency change).

## 1. Database

1. Create a Supabase project (or Neon DB). Note the **Project URL** and keys.
2. Apply the schema. On a self-managed Postgres you are **not** limited to the Qoder migration
   subset — you may add foreign keys, defaults and (recommended) RLS. Start from
   [`schema.sql`](schema.sql), then enable RLS as described in [`DATABASE.md`](DATABASE.md).
   ```sh
   # Supabase: paste schema.sql + rls into the SQL editor, or:
   psql "$SUPABASE_DB_URL" -f docs-cloudflare/schema.sql
   ```
3. Decide the isolation model (see PORTING §5):
   - **Per-request user JWT + RLS owner policies** (recommended — DB-enforced tenancy), or
   - **Service-role key + application scoping** (simpler; keep RLS deny-by-default as backup).

## 2. Build the frontend

```sh
npm ci
npm run build      # tsc --noEmit && vite build → dist/
```
`dist/` is plain static output. Do **not** put secrets in `VITE_*` vars — those are public.

## 3. Deploy the backend Worker

Recommended shape: **one Worker serving both the API and the static assets** (same origin,
so `api.ts` needs no change).

`wrangler.jsonc`:
```jsonc
{
  "name": "whatsai",
  "main": "src/worker.ts",
  "compatibility_date": "2026-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  // Non-secret config only. Secrets go through `wrangler secret put`.
  "vars": { "AI_BASE_URL": "https://api.openai.com/v1", "AI_MODEL": "gpt-4o-mini" }
}
```

Set secrets (never committed):
```sh
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # or SUPABASE_ANON_KEY for the RLS model
npx wrangler secret put AI_API_KEY
npx wrangler secret put META_ACCESS_TOKEN
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put META_APP_ID
```

Deploy:
```sh
npx wrangler deploy
```

> Alternative: deploy `dist/` to **Pages** and the API to a separate **Worker**, wiring a
> Pages Function at `/functions/v1/app` to the Worker via a service binding (PORTING §6).

## 4. Custom domain

- **Worker:** Workers → your Worker → Settings → Domains & Routes → add `yourdomain.com`
  (and/or `app.yourdomain.com`). Cloudflare provisions TLS automatically for zones on your
  account.
- **Pages:** Pages → your project → Custom domains → Set up a custom domain.
- This is the capability Qoder Sites does **not** offer (it is fixed to `*.qoder.website`).

## 5. Auth (identity)

Configure the identity your rewritten `auth.mjs` verifies (PORTING §4):
- **Cloudflare Access:** Zero Trust → Access → Applications → add a self-hosted app for the
  Worker domain, add an identity provider, and a policy allowing your users. Grab the team
  domain + public keys for JWT verification. **Bypass/exclude the webhook path.**
- **Supabase Auth / Clerk / Auth.js:** wire the browser sign-in and forward/verify the token
  in the Worker.

Without this step there is no trusted tenant identity, so multi-tenancy cannot be enforced.

## 6. WhatsApp callback

In Meta → WhatsApp → Configuration, set the callback URL to your deployed API path and
subscribe to `messages`:
```
https://yourdomain.com/functions/v1/app?action=whatsapp.webhook
```
- The verify token must match `META_VERIFY_TOKEN`.
- The path must be **public** (not behind Access) and **signature-verified** via `META_APP_SECRET`.
- Confirm with the dashboard's "Send a test message" (requires `META_ACCESS_TOKEN`).

## 7. Verify the live site

On the deployed domain (not local), run the main flow end to end:
sign in → dashboard → add product → test assistant (grounded answer) → connect WhatsApp →
send an inbound test → see it in the inbox → take over → capture a lead → view analytics.

Record separately: build success, Worker deploy success, and **real** integration behavior.
An HTTP 200 or a ready deploy does not prove the AI or WhatsApp integration works.

## 8. Local development

```sh
npm i -D wrangler
npm run build
npx wrangler dev          # serves dist/ + /functions/v1/app on http://127.0.0.1:8787
```
Local secrets go in `.dev.vars` (gitignored) — see PORTING §8. The Node harness
`dev/run-local.mjs` (in-memory Supabase fake, 36 assertions) still validates backend logic
without the Worker runtime.

## 9. Cost / limits notes

- Workers free tier has daily CPU/request limits; a paid plan removes them. Supabase/Neon have
  their own connection and request limits — use pooling (Hyperdrive or Supabase's pooler) if
  you open direct Postgres TCP connections. supabase-js over HTTP avoids raw connection limits.
- Bundle size: the SPA is >500 kB (no code-splitting yet). Fine to ship; optimize later
  (see [`ROADMAP.md`](ROADMAP.md)).

## Never do

- Never commit `.dev.vars`, keys, or tokens to Git.
- Never place secrets in the frontend bundle or `VITE_*` variables.
- Never trust a client-supplied `businessId`/`userId`; derive the tenant from the verified
  identity only.
- Never expose the Postgres URL/credentials to the browser.
