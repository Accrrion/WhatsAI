# Database — Cloudflare target

Postgres on a provider **you** control (Supabase or Neon). Full DDL in [`schema.sql`](schema.sql).

The big difference from Qoder: because you own the database, you can (and should) enforce
**row-level security** with per-tenant owner policies. The Qoder "anonymous adapter cannot
satisfy RLS owner policies" limitation does **not** apply here.

## Schema subset — no longer a hard constraint

On Qoder the migration API accepted only a restricted subset (no foreign keys, no `DEFAULT`,
no `CHECK`, limited types). On your own Postgres you may use the **full** schema. `schema.sql`
is written to the conservative subset so it applies cleanly in both worlds; you are free to
extend it here:

- Add **foreign keys** (`conversations.business_id → businesses.id`, etc.) for referential integrity.
- Add **`DEFAULT now()`** for `created_at`/`updated_at` instead of setting them in the Worker.
- Add **`CHECK`** constraints (e.g. `unread >= 0`, `quantity > 0`).
- Keep the existing indexes; add composite indexes for hot query paths if needed.

If you want one schema that works on both platforms, keep the conservative subset. If this
deployment is Cloudflare-only, extend it for stronger integrity.

## Tables (17)

| Table | Purpose | Tenant key |
| --- | --- | --- |
| `businesses` | Owner org/business profile, `onboarding_step` | `owner_user_id` |
| `business_hours` | Per-day open/close | `business_id` |
| `policies` | delivery/returns/refunds/exchanges/payments/cancellations | `business_id` |
| `faqs` | Q&A knowledge | `business_id` |
| `products` | Catalogue, price in minor units, `stock_status` | `business_id` |
| `services` | Service catalogue | `business_id` |
| `ai_configs` | Persona, tone, language, handoff, welcome/fallback, `is_active` | `business_id` |
| `whatsapp_accounts` | `phone_number_id`, `waba_id`, `display_phone`, `status` | `business_id` |
| `customers` | End customers, `dedupe_key = businessId:waId` | `business_id` |
| `conversations` | Threads: `status`, `mode` (ai/human), `tags`, unread | `business_id` |
| `messages` | Inbound/outbound, `direction`, `sender`, `status` | `business_id` |
| `conversation_notes` | Internal team notes | `business_id` |
| `leads` | Captured interest, `status` | `business_id` |
| `orders` | Order header, totals, payment_status | `business_id` |
| `order_items` | Order lines | `business_id` |
| `webhook_events` | Idempotency (`event_id` unique), raw payloads | `business_id` |
| `ai_interactions` | Intent, mode, tokens, estimated cost | `business_id` |

## Uniqueness / idempotency

- `businesses.owner_user_id` — one business per owner.
- `customers.dedupe_key` — one customer per WhatsApp number per business.
- `webhook_events.event_id` — duplicate webhook deliveries are skipped.

## Row-level security (recommended)

Enable RLS and add owner policies so Postgres enforces tenancy even if an application query
forgets a filter. Two working models:

### Model A — per-request user JWT (DB-enforced, strongest)
The Worker forwards the authenticated user's Supabase JWT when building the client
(PORTING §5), so `auth.uid()` is the tenant owner. Policies compare against the business owner:

```sql
alter table app.businesses enable row level security;

create policy businesses_owner on app.businesses
  for all
  using (owner_user_id = auth.uid()::text)
  with check (owner_user_id = auth.uid()::text);

-- Child tables scope through their business row:
create policy products_owner on app.products
  for all
  using (business_id in (select id from app.businesses where owner_user_id = auth.uid()::text))
  with check (business_id in (select id from app.businesses where owner_user_id = auth.uid()::text));
-- Repeat the pattern for every business_id-scoped table.
```

### Model B — service-role key + application scoping
The Worker uses `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS) and every query is scoped by
`business_id`/`owner_user_id` in `routes.mjs`. Still enable RLS with a **deny-by-default**
policy for the `anon`/`authenticated` roles so a leaked key or a direct REST hit cannot read
data:
```sql
alter table app.products enable row level security;
-- no permissive policy for anon/authenticated → default deny; only service_role bypasses.
```
Model B is simpler but relies entirely on application correctness. **Prefer Model A** on
Cloudflare since you now have real RLS available.

### Webhook writes
The WhatsApp webhook is server-to-server with no user JWT. Under Model A it must run with the
service role (or a dedicated policy) to insert `webhook_events`/`messages`, because there is no
`auth.uid()` for an inbound Meta call. Keep that path tightly scoped and signature-verified.

## Conventions

- IDs: server-generated (`newId()`), stored as `text`/`uuid`.
- Timestamps: `timestamptz` ISO strings (`nowIso()`), or Postgres `DEFAULT now()` if you extend.
- Money: integer minor units. JSON blobs: `jsonb` (e.g. `social_links`, `tags`).

## Connecting from a Worker

- **Supabase** via `@supabase/supabase-js` uses HTTP/PostgREST — works from a Worker with plain
  `fetch`, no TCP connection pooling needed.
- **Neon / raw Postgres** over TCP should go through **Hyperdrive** (or Neon's serverless driver)
  to avoid exhausting connections from short-lived isolates.
- Never expose the connection string or keys to the browser; they live only in Worker secrets.
