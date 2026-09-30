# Security

## Identity & tenancy
- The Qoder Sites gateway authenticates the visitor and injects `x-qoder-user-context`.
  `requireUser()` decodes/validates it (base64url JSON, strict field checks) server-side.
- The tenant key (`user_id`) is **derived from the verified context, never from frontend
  input**. `businessId`/`organizationId`/`userId` sent by a client are ignored.
- Every query is scoped by `owner_user_id` / `business_id`. Client-supplied record IDs are
  re-validated against the tenant via `ownedRecord()` (404 on mismatch) before any mutation.

## Isolation limitation (must be accepted before production)
The bundled Supabase adapter is **anonymous** (no `auth.uid()`), so database-level RLS
*owner* policies cannot be enforced. Tenant isolation is therefore **application-enforced**
in the Function and verified by the isolation tests in `dev/run-local.mjs`
("other user sees no business", "other user cannot list Paul's products"). This is a
documented scope decision: a functional test with application-level isolation, not
provider-enforced row security.

## Secrets
- Stored only as Qoder Sites **Secrets**, read server-side via `Deno.env.get`.
- Never in Git, never in the frontend bundle, never logged. Reserved prefixes blocked:
  `QODER_`, `SUPABASE_`, `POSTGRES_`, `DATABASE_URL`.
- AI replies pass through `sanitizeReply()` to redact any secret-like content before egress.

## Input handling
- Validators cap lengths and constrain values to allow-lists (`oneOf`); request bodies
  capped at 256 KB.
- DB access is via the Supabase query builder (parameterized) — no string-concatenated SQL,
  mitigating SQL injection.
- React escapes output by default, mitigating XSS.

## Webhooks
- `X-Hub-Signature-256` HMAC-SHA256 verified with `META_APP_SECRET` (constant-time compare).
- Idempotent via unique `event_id` — replayed deliveries are skipped.
- Always returns 200 to avoid Meta retry storms; failures are logged, not leaked.

## AI safety
- Business knowledge and customer messages are treated as **untrusted data**, not instructions.
- The model is barred from revealing system prompts, credentials, internal tools, or other
  tenants' data. Grounding rules prevent fabricated prices/stock/policies/order status.

## Platform-handled
TLS, auth/session issuance, CSRF at ingress, and secure transport are handled by the Qoder
Sites gateway. Application-level rate limiting and audit-log surfacing are post-MVP items
(see `docs/ROADMAP.md`).
