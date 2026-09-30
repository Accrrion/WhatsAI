# Security — Cloudflare target

The master build prompt's invariants are unchanged and, on Cloudflare, **enforceable at the
database layer** rather than application-only.

## Identity & tenancy

- On Qoder the gateway injected a verified `x-qoder-user-context` header. **Cloudflare does
  not.** You must supply a trusted identity and verify it server-side in the Worker
  (PORTING §4). Options: **Cloudflare Access JWT**, **Supabase Auth token**, or your own
  session/IdP (Clerk, Auth.js).
- The tenant key (`user_id`) is **derived from the verified token, never from frontend input**.
  `businessId`/`organizationId`/`userId` sent by a client are ignored.
- Every query is scoped by `owner_user_id` / `business_id`. Client-supplied record IDs are
  re-validated against the tenant via `ownedRecord()` (404 on mismatch) before any mutation.
- **Verify, don't trust:** an unverified JWT or a client-set identity header is an
  authentication bypass. Always check signature, `aud`, and `exp` (use `jose` in the Worker).

## Isolation — now DB-enforceable (limitation removed)

The Qoder deployment could only enforce tenancy in application code because its anonymous
adapter could not satisfy RLS owner policies. **On Cloudflare you own the Postgres, so enable
real RLS** (DATABASE.md §Row-level security):

- **Preferred:** forward the authenticated user's JWT to Supabase and add `owner` policies
  (`auth.uid() = owner_user_id`), so a tenant physically cannot touch another tenant's rows.
- **Fallback:** service-role key + application scoping, with RLS **deny-by-default** for
  `anon`/`authenticated` so a leaked key or direct REST hit cannot read data.

Keep the existing isolation regression tests (`dev/run-local.mjs`: "other user sees no
business", "other user cannot list Paul's products") and add an RLS-level test that queries
as tenant A for tenant B's rows and expects zero.

## Secrets

- Stored only as **Worker secrets** (`wrangler secret put …`) / local `.dev.vars`; read via the
  `env` binding. Never in Git, never in the frontend bundle, never as `VITE_*` (public at build).
- Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY` for the RLS
  model), `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `META_ACCESS_TOKEN`, `META_APP_SECRET`,
  `META_VERIFY_TOKEN`, `META_APP_ID`.
- AI replies pass through `sanitizeReply()` to redact any secret-like content before egress.
- Cloudflare secret values are write-only via Wrangler/dashboard; they are not echoed back.

## Transport, edge & DDoS

- TLS is terminated at the Cloudflare edge for your domain automatically.
- Cloudflare provides baseline DDoS protection, a WAF, and rate-limiting rules at the edge —
  configure **rate limiting** on the API path and especially the public webhook path.
- The Qoder gateway handled auth/session issuance and CSRF at ingress; **on Cloudflare that is
  your responsibility** (Access policy, SameSite cookies / CSRF tokens for session-based auth,
  CORS restricted to your origin).

## Input handling

- Validators cap lengths and constrain values to allow-lists (`oneOf`); request bodies capped
  at 256 KB.
- DB access is via the Supabase query builder (parameterized) or a parameterized driver — no
  string-concatenated SQL, mitigating SQL injection.
- React escapes output by default, mitigating XSS.

## Webhooks (public surface)

- The webhook path is **public** (Meta server-to-server). It must be **excluded** from Access/
  auth but protected by `X-Hub-Signature-256` HMAC-SHA256 verified with `META_APP_SECRET`
  (constant-time compare).
- Idempotent via unique `event_id` — replayed deliveries are skipped.
- Always returns 200 to avoid Meta retry storms; failures are logged, not leaked.
- Add a Cloudflare rate limit on this path and, if possible, restrict by Meta's published IP
  ranges.

## AI safety

- Business knowledge and customer messages are treated as **untrusted data**, not instructions.
- The model is barred from revealing system prompts, credentials, internal tools, or other
  tenants' data. Grounding rules prevent fabricated prices/stock/policies/order status.
- Tools are tenant-scoped and return only grounded data; the LLM never gets unrestricted DB access.

## Pre-launch security checklist

- [ ] Worker verifies identity server-side; no client-trusted id header is honored.
- [ ] RLS enabled with owner policies (or deny-by-default + service role).
- [ ] All secrets in Worker secrets / `.dev.vars`; none in Git or frontend; no `VITE_` secrets.
- [ ] Webhook path public, signature-verified, rate-limited.
- [ ] API path rate-limited; CORS limited to your origin; CSRF handled for session auth.
- [ ] Isolation tests pass at both application and RLS level.
- [ ] `sanitizeReply()` active; AI grounding rules enforced.
