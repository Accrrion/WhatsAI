# Architecture

## Topology
```
Browser (React SPA, dist/)
   │  same-origin fetch  /functions/v1/app?action=<name>
   ▼
Qoder Sites Gateway  ── injects x-qoder-user-context (verified identity), x-instance-id
   ▼
Edge Function "app" (Deno)  functions/index.ts
   ├─ adapter.mjs   serveSite(): per-request Supabase client (anon key), routing headers stripped
   ├─ handler.mjs   action router, auth gate, method check, webhook public path
   ├─ routes.mjs    ~40 tenant-scoped handlers
   ├─ ai/           provider.mjs · prompts.mjs · orchestrator.mjs · tools.mjs
   ├─ whatsapp/     client.mjs · webhook.mjs
   ├─ db.mjs        HTTP + tenancy helpers, validators
   └─ seed.mjs      demo data
   ▼
Supabase Postgres (schema app.*)
```

## Frontend
- `src/main.tsx` → `src/App.tsx` (AppProvider + Router + Toaster).
- `store.tsx` — React context: bootstrap load, mode (live/demo), route, auth error.
- `api.ts` — `callAction()` tries the live Function; on backend-down it falls back to a
  labeled in-memory **demo** adapter so the static preview is explorable. Auth errors
  (401/403) are never swallowed.
- `components/Landing.tsx` — marketing page. `components/app/AppShell.tsx` — sidebar shell.
  `components/app/pages/*` — 12 dashboard pages. `components/app/shared.tsx` — primitives.
- `lib/config.ts` — `BRAND`, money/date helpers, label maps. `lib/utils.ts` — `cn()`.
- Alias `@/*` → project root (so `@/components/ui/*`, `@/api`, `@/store`, `@/lib/*`).

## Backend request lifecycle
1. Gateway verifies the visitor and injects `x-qoder-user-context`.
2. `serveSite` builds a routed Supabase client and calls `handle({request, supabase})`.
3. `handle` reads `?action=`. `whatsapp.webhook` is public; all else requires `requireUser`.
4. Method allow-list checked; handler dispatched; errors mapped to safe JSON
   (`appError` → coded response, `UserContextError` → 401/403, unknown → 503).

## Tenancy
`requireUser(request)` → `user_id`. `getBusinessForUser` resolves the caller's business by
`owner_user_id`. Every record query filters by `business_id`. IDs from the client are
re-validated against the tenant via `ownedRecord()`. See `docs/SECURITY.md` for the
isolation limitation.

## Key design decisions
- ONE `app` Function (platform constraint) with an internal action router.
- Provider-agnostic AI: swap `AI_BASE_URL`/`AI_MODEL`; grounded retrieval fallback keeps the
  product functional and honest without credentials.
- Money in integer minor units (kobo); NGN symbol ₦.
- Static frontend + Function backend → containerizable, no framework server.
