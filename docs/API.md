# API

All calls: `GET|POST /functions/v1/app?action=<name>`. JSON in/out. Every action except
`whatsapp.webhook` requires the gateway-verified user context. Errors return
`{ ok:false, error:<code> }` with an appropriate HTTP status.

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
`db.mjs` validators: `str/optStr` (length caps), `int` (min/max), `bool`, `oneOf`
(allow-lists with fallback), `uuid`, `json`. Bodies capped at 256 KB. IDs from the client
are re-checked against the tenant via `ownedRecord()` before mutating.

## Response envelope
Success: `{ ok:true, ...data }`. Failure: `{ ok:false, error:<code>, hint? }`.
The browser `requestJson()` maps gateway/`code`/`ok:false` to a thrown `ApiError`.

## Webhook contract
- **GET** `?hub.mode=subscribe&hub.verify_token=<t>&hub.challenge=<c>` → echoes `hub.challenge`
  as plain text when the token matches `META_VERIFY_TOKEN`; else 403.
- **POST** Meta event JSON → signature verified (if `META_APP_SECRET` set) → `handleInbound`
  → always 200 (Meta retries on non-2xx). Returns `{received, processed}`.
