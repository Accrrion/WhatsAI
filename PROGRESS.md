# Progress & TODO

Living tracker for the WhatsAI build. Update as phases complete.

## Completed
- [x] Phase 0 — Discovery, stack choice, project scaffold (React 19 + Vite 8 + Tailwind v4 + Shadcn).
- [x] Brand theme (teal/WhatsApp-green), central `BRAND` config, money/date helpers.
- [x] Database schema — 16 tables (`docs/schema.sql`), migration-safe subset only.
- [x] Edge Function backend — router, ~40 tenant-scoped actions, validators, tenancy helpers.
- [x] AI engine — provider abstraction, prompts, orchestrator, 11 tools, grounded retrieval fallback, sanitization.
- [x] WhatsApp — Cloud API client, webhook verify + inbound, HMAC signature, idempotency, status handling.
- [x] Seed data — Paul's Fashion Store.
- [x] Frontend API layer with labeled demo fallback; app store; sidebar shell.
- [x] Landing page (11 conversion sections).
- [x] Dashboard pages: Overview, Conversations inbox (handoff/reply/notes/tags), Customers, Leads, Products, Orders, Knowledge base, Test Assistant, WhatsApp, Analytics, Settings, Onboarding (11 steps).
- [x] Local backend harness — **36/36 passing**.
- [x] `npm run build` green; production preview serves HTTP 200.
- [x] Implementation report (`docs/IMPLEMENTATION_REPORT.md`).

## In progress
- [ ] Phase: docs set (ARCHITECTURE/DATABASE/API/AI/WHATSAPP/SECURITY/DEPLOYMENT/ROADMAP).

## TODO — requires user authorization (cloud)
- [ ] Enable Functions + Database backends (`ensure_backend`).
- [ ] Accept anonymous-grant tenancy/isolation scope (see report §7).
- [ ] Create + apply DB migration with anonymous access policies.
- [ ] Enter Secrets in Sites Settings: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_APP_ID`.
- [ ] `prepare_site` (webDirectory `dist`, spa, functionDirectory `functions`, databaseAccess read_write, secretNames).
- [ ] Publish via sites-hosting; verify live login → dashboard → AI → webhook on the published URL.

## TODO — future phases (post-MVP)
- [ ] Payments (Paystack/Flutterwave) abstraction + webhook.
- [ ] Bookings, staff accounts, team roles (ADMIN/AGENT), multi-number.
- [ ] WhatsApp media messages (image/audio/document).
- [ ] Production rate limiting; audit log surfacing in UI.
- [ ] Frontend code-splitting to reduce bundle size.
- [ ] Nigerian language coverage beyond config options (Pidgin/Yoruba/Igbo/Hausa) validation.

## MVP acceptance (per spec)
Register → create business → add products → add info → configure AI → connect WhatsApp
(official Meta) → receive/process customer message → grounded answer → send back → view in
dashboard → take over → capture lead → view analytics. **All flows implemented in code;
end-to-end live verification pending cloud deployment + credentials.**
