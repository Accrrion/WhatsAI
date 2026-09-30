# Deployment

Hosted delivery uses Qoder Sites: a static frontend (`dist/`) plus ONE `app` Edge Function
and a Supabase Postgres database. Cloud steps require explicit user authorization.

## Prerequisites (authorization gates)
Before creating any cloud resource, confirm with the user:
1. **Enable backends** — Functions + Database (`ensure_backend`).
2. **Accept isolation scope** — application-enforced tenancy with the anonymous adapter
   (no DB-level RLS owner policies). See `docs/SECURITY.md`.
3. **Enter Secrets** in Sites → Settings: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`,
   `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_APP_ID`.

## Build
```sh
npm ci
npm run build      # tsc --noEmit && vite build → dist/
```

## Prepare & publish (sites-hosting skill)
1. `get_local_context` — confirm project binding.
2. `prepare_site` with:
   - `webDirectory: "dist"`, `spa: true`
   - `functionDirectory: "functions"`
   - `databaseAccess: "read_write"`
   - `requiredSchemaVersion` (from the migration)
   - `secretNames`: the secrets above
   - anonymous `accessPolicies` for the tables
3. `create_database_migration` from `docs/schema.sql`, then `apply_database_migration`.
4. `release_backend` (Function + DB), then `publish_site`.
5. Verify on the **published** URL (the publication preview shows the frontend but cannot
   execute Functions): sign in → dashboard → add product → test assistant → connect
   WhatsApp → send inbound test → view in inbox → take over → capture lead → analytics.

## WhatsApp callback
After publishing, set the Meta callback URL to
`https://<published-host>/functions/v1/app?action=whatsapp.webhook` and subscribe to
`messages`. Verify with the dashboard's "Send a test message".

## Local (no cloud)
```sh
npm run dev                 # frontend on loopback
node dev/run-local.mjs      # backend harness, in-memory Supabase fake (36 assertions)
npm run build && npm run preview
```
`dev/function-local.ts` optionally runs the real Function under Deno.

## Notes
- The static publication preview falls back to the labeled **demo** adapter (Functions can't
  run there); live login/database/AI require the published site.
- Never commit secrets; never place keys in the frontend.
