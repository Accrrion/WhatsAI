# WhatsApp Integration

Official **Meta WhatsApp Business Platform (Cloud API)** only — Graph API v21.0.
No unofficial automation libraries.

## Outbound (`functions/whatsapp/client.mjs`)
`sendText(env, {phoneNumberId, to, text})` → `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`
with `messaging_product: "whatsapp"`, type `text`. Requires `META_ACCESS_TOKEN`.
`whatsappConfigured(env)` gates sends; without a token the app still processes and stores
messages and replies in-app, but does not deliver to WhatsApp.

## Inbound webhook (`functions/whatsapp/webhook.mjs`)
Public action `whatsapp.webhook`:
- **GET verify:** matches `hub.verify_token` against `META_VERIFY_TOKEN`, echoes
  `hub.challenge` (plain text). 403 on mismatch.
- **POST events:**
  1. Verify `X-Hub-Signature-256` = HMAC-SHA256 of the raw body with `META_APP_SECRET`
     (constant-time compare). Skipped only if the secret is unset.
  2. Resolve the business by `phone_number_id`.
  3. **Idempotency:** insert into `webhook_events` with unique `event_id`; duplicates skip.
  4. Upsert the customer (`dedupe_key = businessId:waId`), find/open the conversation.
  5. Store the inbound message.
  6. If AI is active and not in human handoff → run orchestrator → store outbound →
     record usage → send via WhatsApp if configured.
  7. Status callbacks (sent/delivered/read) update the matching message by `wa_message_id`.
  - Always returns HTTP 200 (Meta retries otherwise). Body: `{received, processed}`.

## Connection setup (dashboard → WhatsApp page)
1. In Meta: create an app, add WhatsApp, get the **Phone Number ID** and **WABA ID**.
2. Enter them on the WhatsApp page (stored in `whatsapp_accounts`).
3. Set Secrets: `META_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_APP_ID`.
4. In Meta → WhatsApp → Configuration, set the callback URL to
   `https://<your-site>/functions/v1/app?action=whatsapp.webhook` and subscribe to `messages`.
5. Use "Send a test message" to verify delivery.

## Limits / scope
Text messages only in this release (no image/audio/document/location). One WhatsApp number
per business. Template-message marketing flows are out of scope for the MVP.
