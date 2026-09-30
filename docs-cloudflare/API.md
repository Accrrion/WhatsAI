# API — Cloudflare target

The action contract is **unchanged**. All calls remain:
`GET|POST /functions/v1/app?action=<name>`, JSON in/out. On Cloudflare this path is served by
the **Worker** (PORTING §6) instead of a Qoder Function, so the frontend `api.ts` needs no edits.

Every action except `whatsapp.webhook` requires the **Worker-verified** user identity (your
auth — Cloudflare Access JWT / Supabase Auth / session — not a client-supplied header). Errors
return `{ ok:false, error:<code> }` with an appropriate HTTP status.

## Actions

| Action | Method | Purpose |
| --- | --- | --- |
| `me` | GET | Current user projection |
| `bootstrap` | GET | Business + aiConfig + whatsapp + counts + aiProvider |
| `seed` | POST | Seed Paul's Fashion Store (409 if business exists) |
| `business.save` | POST | Create/update business profile + `onboarding_step` |
| `hours.get` / `hours.set` | GET/POST | Opening hours |
| `policies.get` / `policies.save` | GET/POST | Policies by kind |
| `products.list/create/update/delete` | GET/POST | Catalogue CRUD |
| `services.list/save/delete` | GET/POST | Services CRUD |
| `faqs.list/save/delete` | GET/POST | FAQs CRUD |
| `aiConfig.get` / `aiConfig.save` | GET/POST | Assistant persona + provider status |
| `ai.test` | POST | Sandbox: `{message, history}` → reply/intent/mode/sources/handoff/usage |
| `whatsapp.get/save/test` | GET/POST | Connection details, status, test send |
| `customers.list` | GET | Customers |
| `conversations.list/get` | GET | Inbox list / thread + messages |
| `conversations.reply` | POST | Human reply (delivers if WhatsApp configured) |
| `conversations.takeover/returnToAi/resolve` | POST | Handoff lifecycle |
| `conversations.tag/note` | POST | Tags, internal notes |
| `leads.list/save/delete` | GET/POST | Leads CRUD |
| `orders.list/save` | GET/POST | Orders |
| `analytics` | GET | 30d totals, intents, 14-day series |
| `whatsapp.webhook` | GET/POST | **Public.** Meta verify handshake + inbound events |

## Validation

`db.mjs` validators are unchanged: `str/optStr` (length caps), `int` (min/max), `bool`, `oneOf`
(allow-lists with fallback), `uuid`, `json`. Bodies capped at 256 KB. IDs from the client are
re-checked against the tenant via `ownedRecord()` before mutating.

## Response envelope

Success: `{ ok:true, ...data }`. Failure: `{ ok:false, error:<code>, hint? }`.
The browser `requestJson()` maps a `code`/`ok:false`/non-JSON response to a thrown `ApiError`.
When the Worker is unreachable, `api.ts` falls back to the labeled in-browser demo adapter
(`BACKEND_DOWN` codes / HTTP 503) — useful for a frontend-only Cloudflare deploy.

## Webhook contract

- **GET** `?hub.mode=subscribe&hub.verify_token=<t>&hub.challenge=<c>` → echoes `hub.challenge`
  as plain text when the token matches `META_VERIFY_TOKEN`; else 403.
- **POST** Meta event JSON → signature verified (if `META_APP_SECRET` set) → `handleInbound`
  → always 200 (Meta retries on non-2xx). Returns `{received, processed}`.

## Cloudflare-specific notes

- **Same origin:** serve the API and SPA from one Worker (or proxy Pages → Worker) so
  `credentials: "same-origin"` and CORS behave; avoid cross-origin calls from the browser.
- **CORS:** if the API is on a different hostname than the SPA, set `Access-Control-Allow-Origin`
  to your exact frontend origin (never `*` with credentials).
- **Rate limiting:** apply Cloudflare rate-limit rules to `/functions/v1/app` and a stricter
  rule to the public webhook path.
- **Methods:** the Worker `fetch` receives all methods; the per-action method allow-list in
  `handler.mjs` still returns 405 for mismatches.
