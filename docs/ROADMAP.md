# Roadmap

Phased plan per the master build prompt. The MVP focuses on doing the core WhatsApp AI
assistant extremely well before expanding.

## Delivered (MVP)
- Phases 0–2: discovery, scaffold, schema, backend, AI engine, WhatsApp webhook.
- Phases 3–7: knowledge base, conversation inbox + human handoff, leads, orders, analytics.
- Phases 8–10: landing page, onboarding wizard, test sandbox, demo adapter, docs.

## Near-term (post-MVP, pre-launch)
- **Cloud deployment** + live end-to-end verification (gated on user authorization).
- **Payments:** Paystack/Flutterwave abstraction, checkout links, payment webhooks,
  order/payment reconciliation. AI may only confirm payment after backend confirmation.
- **WhatsApp media:** inbound/outbound image, audio, document, location.
- **Team & roles:** ADMIN/AGENT beyond OWNER; assignment, internal mentions.
- **Multi-number:** several WhatsApp numbers per business; routing.
- **Rate limiting & audit:** application-level throttling; audit-log surface in the UI.
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
- Tenant isolation derived from verified identity, never client input.
- Secrets server-side only; never in Git or the frontend.
- No fake integrations — clearly mark what is implemented vs. pending credentials.
