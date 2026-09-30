# Database

Postgres (Supabase), schema `app.*`. Full DDL in `docs/schema.sql`.

## Migration subset (platform constraint)
Only these are allowed in a migration:
- `CREATE TABLE app.<t>` with columns typed: `boolean, integer, bigint, text, uuid, timestamptz, jsonb` **only**.
- `ALTER TABLE ... ADD COLUMN` (nullable, no default).
- Plain `CREATE INDEX`.

Not allowed: arrays, `date`, `numeric`, `varchar(n)`, foreign keys, `DEFAULT`, `CHECK`.
Referential integrity and tenancy are therefore **application-enforced**.

## Tables (16)
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

## Access policies
Declared as anonymous templates at `prepare_site`. The anonymous adapter cannot satisfy
`owner` (auth.uid()) policies, so row access is gated in application code, not by RLS.
See `docs/SECURITY.md` §Isolation.

## Conventions
- IDs: server-generated (`newId()`), stored as `text`/`uuid`.
- Timestamps: `timestamptz` ISO strings (`nowIso()`).
- Money: integer minor units. JSON blobs: `jsonb` (e.g. `social_links`, `tags`).
