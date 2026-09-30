# Architecture — Cloudflare target

## Topology (full stack)

```
Browser (React SPA, dist/)  ── same-origin fetch ──▶  /functions/v1/app?action=<name>
                                                             │
                                          Cloudflare Worker (V8 isolate, not Deno)
                                                             │
   ┌─────────────────────────────────────────────────────────┼───────────────────────────┐
   │ Static Assets binding (ASSETS.fetch) serves the SPA      │ API path runs the router   │
   │ for every non-API route (SPA fallback)                   │                            │
   ▼                                                          ▼                            ▼
Cloudflare edge / your custom domain              src/worker.ts (fetch handler)      Auth layer
                                                    ├─ builds Supabase client        (Cloudflare Access JWT,
                                                    │  from Worker secrets            Supabase Auth, or your
                                                    ├─ env(name) = workerEnv[name]    own session) → user_id
                                                    ├─ handle() → action router
                                                    │    (functions/handler.mjs)
                                                    ├─ routes.mjs  ~40 tenant-scoped handlers
                                                    ├─ ai/  provider · prompts · orchestrator · tools
                                                    ├─ whatsapp/  client · webhook
                                                    └─ db.mjs  HTTP + tenancy helpers, validators
                                                             ▼
                                          Your Postgres (Supabase / Neon), schema app.*
                                          with ROW-LEVEL SECURITY owner policies
```

## How this differs from the Qoder deployment

| Concern | Qoder Sites | Cloudflare |
| --- | --- | --- |
| Backend runtime | Deno (`Deno.serve`) | Worker (V8 isolate, `fetch` handler) |
| Static hosting | Qoder gateway serves `dist/` | Worker Static Assets **or** Pages |
| Custom domain | Not supported (`*.qoder.website` only) | Supported (your domain + TLS) |
| Identity | Gateway injects verified `x-qoder-user-context` | **You provide it** (Access JWT / Supabase Auth / session) |
| Tenant routing | Gateway injects `x-instance-id` | Not present; adapter replaced |
| DB credentials | Gateway injects `SUPABASE_URL`/`SUPABASE_ANON_KEY` | Your Worker secrets (Supabase/Neon) |
| DB isolation | Anonymous adapter → **no RLS owner policies** (app-enforced only) | **Real RLS** with per-request user JWT (DB-enforced) |
| Secrets | Qoder Sites Secrets, `Deno.env.get` | `wrangler secret put`, `env` binding |

## Frontend (unchanged)

- `src/main.tsx` → `src/App.tsx` (AppProvider + Router + Toaster).
- `store.tsx` — React context: bootstrap load, mode (live/demo), route, auth error.
- `api.ts` — `callAction()` tries `/functions/v1/app`; on backend-down it falls back to the
  labeled in-memory **demo** adapter. Auth errors (401/403) are never swallowed. **No change
  needed** as long as the Worker serves the API at the same path.
- `components/Landing.tsx` — marketing page. `components/app/AppShell.tsx` — sidebar shell.
  `components/app/pages/*` — dashboard pages. `components/app/shared.tsx` — primitives.
- `lib/config.ts` — `BRAND`, money/date helpers, label maps. Alias `@/*` → project root.

## Backend request lifecycle (Worker)

1. `fetch(request, env)` runs. Non-API paths → `env.ASSETS.fetch(request)` (SPA).
2. API path → build the Supabase client from `env` secrets and an `env(name)` accessor.
3. `handle({ request, supabase, env })` reads `?action=`. `whatsapp.webhook` is public;
   everything else calls `requireUser(request)` against **your** verified identity.
4. Method allow-list checked; handler dispatched; errors mapped to safe JSON
   (`appError` → coded response, `UserContextError` → 401/403, unknown → 503).

## Tenancy

`requireUser(request)` → `user_id` (from your auth, never client input). `getBusinessForUser`
resolves the caller's business by `owner_user_id`. Every query filters by `business_id`, and
client-supplied record IDs are re-validated via `ownedRecord()`. On Cloudflare you can
**additionally** enforce this in Postgres with RLS owner policies (recommended) so a scoping
bug cannot leak cross-tenant data. See [`SECURITY.md`](SECURITY.md) and [`DATABASE.md`](DATABASE.md).

## Key design decisions (carried over)

- ONE API entry with an internal action router (now a Worker `fetch`, not a Deno Function).
- Provider-agnostic AI: swap `AI_BASE_URL`/`AI_MODEL`; grounded retrieval fallback keeps the
  product functional and honest without credentials.
- Money in integer minor units (kobo); NGN symbol ₦.
- Static SPA + serverless backend → portable across Cloudflare, and containerizable elsewhere.

## Runtime caveats (Worker vs Deno)

- No `Deno.*` APIs. Use Web standard `fetch`, `crypto.subtle`, `TextEncoder`, `URL` — the
  codebase already relies on these, so most of `functions/` is runtime-agnostic.
- `nodejs_compat` covers any Node built-ins a dependency needs; prefer Web APIs.
- Per-request CPU limits apply; the AI orchestrator's multi-round tool loop should stay within
  them (it already caps rounds).
