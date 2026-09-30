# Roadmap — Cloudflare target

Phased plan per the master build prompt, adjusted for delivering on Cloudflare. The MVP focuses
on doing the core WhatsApp AI assistant extremely well before expanding.

## Delivered (MVP, code-complete)

- Phases 0–2: discovery, scaffold, schema, backend, AI engine, WhatsApp webhook.
- Phases 3–7: knowledge base, conversation inbox + human handoff, leads, orders, analytics.
- Phases 8–10: landing page, onboarding wizard, test sandbox, demo adapter, docs.
- Local backend harness: **36/36 passing**; `npm run build` green.

## Cloudflare port (this doc set)

- [ ] **Port the backend** Deno → Worker per [`PORTING.md`](PORTING.md) (entry, adapter
      replacement, env threading, dependency change).
- [ ] **Implement identity** — replace `x-qoder-user-context` with Cloudflare Access JWT or
      Supabase Auth; rewrite `requireUser()`. *(Highest priority — tenancy depends on it.)*
- [ ] **Provision Postgres** (Supabase/Neon), apply `schema.sql`, **enable RLS** with owner
      policies (DATABASE.md).
- [ ] **Deploy** Worker + static assets (or Pages + Worker), set secrets, attach custom domain.
- [ ] **Wire the webhook** on the public path with Access bypass + rate limiting; verify with Meta.
- [ ] **End-to-end verification** on the live domain (sign in → product → AI → webhook → inbox →
      handoff → lead → analytics).

## Near-term (post-port, pre-launch)

- **Real RLS isolation tests** at the database level (query as tenant A for tenant B → expect 0).
- **Edge hardening:** rate limiting, WAF rules, CORS to your origin, CSRF for session auth.
- **Payments:** Paystack/Flutterwave abstraction, checkout links, payment webhooks,
  order/payment reconciliation. AI may only confirm payment after backend confirmation.
- **WhatsApp media:** inbound/outbound image, audio, document, location.
- **Team & roles:** ADMIN/AGENT beyond OWNER; assignment, internal mentions.
- **Multi-number:** several WhatsApp numbers per business; routing.
- **Observability:** structured Worker logging (no secrets), error tracking, audit-log surface.
- **Performance:** frontend code-splitting; bundle < 500 kB.

## Later phases

- **Bookings/scheduling** for service businesses.
- **Staff management** and permissions.
- **Broadcasts/templates** (Meta-approved template messages).
- **Nigerian languages:** validate and tune Pidgin/Yoruba/Igbo/Hausa beyond config options.
- **Advanced analytics:** conversion funnels, cohort/retention, CSAT.
- **Marketplace/extensions:** CRM export, Sheets, Zapier-style hooks.

## Guiding constraints (carry through every phase)

- Official Meta WhatsApp API only.
- AI never fabricates prices/stock/policies/order or payment status.
- Tenant isolation derived from verified identity, never client input — and enforced by RLS.
- Secrets server-side only (Worker secrets / `.dev.vars`); never in Git or the frontend.
- No fake integrations — clearly mark what is implemented vs. pending credentials.
