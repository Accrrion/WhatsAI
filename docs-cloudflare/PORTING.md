# Porting `functions/` from Qoder (Deno) to a Cloudflare Worker

The backend in `functions/` is written for the **Qoder Sites Deno runtime** and its
**gateway-injected** identity, tenant routing and Supabase credentials. Cloudflare Workers
provide none of those, so four things must change. Everything else (the ~40 actions in
`routes.mjs`, the AI engine in `ai/`, the WhatsApp logic in `whatsapp/`, the validators in
`db.mjs`) ports unchanged because it already receives `{ request, supabase, env, user, ... }`
as a context object.

> Work on a copy/branch. Do not delete the Qoder `functions/` until the Worker is verified.

---

## Summary of required changes

| # | File | Qoder behavior | Cloudflare change |
| --- | --- | --- | --- |
| 1 | `functions/index.ts` | `Deno.serve(serveSite(handle, …))` | Worker `export default { fetch }` |
| 2 | `functions/adapter.mjs` | Requires `x-instance-id` header + injected `SUPABASE_URL`/`SUPABASE_ANON_KEY`; strips routing headers | **Replace** with a plain client built from Worker secrets |
| 3 | `functions/handler.mjs` (line 9) | `const env = (name) => Deno.env.get(name)` | Take `env` from the Worker binding, passed per request |
| 4 | `functions/auth.mjs` | Trusts gateway `x-qoder-user-context` | Verify **your own** identity (Cloudflare Access JWT / Supabase Auth / session) |
| 5 | `@supabase/supabase-js` | `npm:` specifier, pinned 2.57.4 | Normal npm dependency, bundled by Wrangler |

---

## 1. Worker entry point (`functions/index.ts` → `src/worker.ts`)

Replace the Deno entry with a Worker `fetch` handler. This example uses the
**Worker + Static Assets** model so one deployment serves both the SPA and the API on the
same origin (keeps `api.ts` calling `/functions/v1/app` unchanged):

```ts
// src/worker.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { handle } from "../functions/handler.mjs";
import { getUser } from "../functions/auth.mjs"; // rewritten — see §4

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }; // static-asset binding
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string; // server-only secret; see §5 for the RLS-safe alternative
  AI_API_KEY?: string; AI_BASE_URL?: string; AI_MODEL?: string; AI_PROVIDER?: string;
  META_ACCESS_TOKEN?: string; META_APP_SECRET?: string; META_VERIFY_TOKEN?: string; META_APP_ID?: string;
}

const API_PATH = "/functions/v1/app";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Anything that is not the API path is served from the static SPA bundle.
    if (url.pathname !== API_PATH) return env.ASSETS.fetch(request);

    // env accessor compatible with the existing `env(name)` calls throughout functions/.
    const readEnv = (name: string) => (env as unknown as Record<string, string | undefined>)[name];

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    return handle({ request, supabase, env: readEnv });
  },
} satisfies ExportedHandler<Env>;
```

Key points:
- `readEnv` preserves the existing `env("META_VERIFY_TOKEN")` call style used in
  `handler.mjs` and `whatsapp/`, so those files need **no** changes for env access.
- `handle` now needs to accept `env` (see §3).

## 2. Replace `functions/adapter.mjs`

`serveSite()` is Qoder-specific: it 503s unless an `x-instance-id` UUID header is present
(`adapter.mjs:11-12`) and builds the Supabase client from gateway-injected
`SUPABASE_URL`/`SUPABASE_ANON_KEY`. Cloudflare injects neither. **Do not port it.** The
Worker entry in §1 constructs the client directly from Worker secrets instead, so
`adapter.mjs` and `dev/function-local.ts` are simply not used on Cloudflare.

If you want to keep a local Deno harness, leave `adapter.mjs` for that only; it is never
deployed to the Worker.

## 3. `functions/handler.mjs` — thread `env` instead of `Deno.env`

Delete the module-level Deno accessor and accept `env` from the caller:

```diff
- const env = (name) => Deno.env.get(name);
-
- async function handleWebhook(request, supabase) {
+ async function handleWebhook(request, supabase, env) {
    …
  }

- export async function handle({ request, supabase }) {
+ export async function handle({ request, supabase, env }) {
    …
-   if (action === "whatsapp.webhook") return handleWebhook(request, supabase);
+   if (action === "whatsapp.webhook") return handleWebhook(request, supabase, env);
    …
    // line 120 already passes `env` into the route context — unchanged.
  }
```

Nothing else in `handler.mjs` changes: the action `REGISTRY`, the public
`whatsapp.webhook` path, the `requireUser` gate and the error mapping all stay.

## 4. `functions/auth.mjs` — supply your own verified identity (CRITICAL)

`getUser()` currently decodes the gateway-injected `x-qoder-user-context` header
(`auth.mjs:18`). **That header does not exist on Cloudflare**, and you must not let the
client set it. The tenant `user_id` must come from an identity **you** verify server-side.
Pick one:

### Option A — Cloudflare Access (Zero Trust), simplest for an internal/owner app
Access puts a signed JWT in `Cf-Access-Jwt-Assertion`. Verify it against your team's public
keys (JWKS) and use the `email`/`sub` as the tenant key:

```js
// functions/auth.mjs (Cloudflare Access variant) — sketch
export class UserContextError extends Error {
  constructor(code, status) { super(code); this.name = "UserContextError"; this.code = code; this.status = status; }
}
export function requireUser(request) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) throw new UserContextError("login_required", 401);
  // VERIFY the JWT signature (ES256) against your Access team JWKS, aud, and exp.
  // Do NOT trust an unverified token. Use a library (e.g. jose) in the Worker.
  const claims = verifiedClaimsOrThrow(jwt);
  return Object.freeze({ user_id: claims.sub, name: claims.email, picture: "" });
}
export const getUser = (request) => { try { return requireUser(request); } catch { return null; } };
```
Protect the app with an Access policy so unauthenticated visitors are challenged before they
ever reach the Worker. **Exclude the webhook path** (`/functions/v1/app?action=whatsapp.webhook`)
from Access — Meta calls it server-to-server (see §Webhook below).

### Option B — Supabase Auth (recommended for a public multi-tenant SaaS)
The browser signs in to Supabase and sends its **access token**; the Worker verifies it and
uses `sub` as `user_id`. This also lets you enable **real RLS** (§5) by forwarding the user
JWT to Postgres, so isolation is enforced by the database, not just application code.

### Option C — Your own session / another IdP (Clerk, Auth.js, Lucia)
Validate the session cookie/JWT in the Worker and derive `user_id`. Same rule: server-verified
only, never a client-supplied id.

Whatever you choose, keep the existing contract: `requireUser(request)` returns
`{ user_id, name, picture }` and throws `UserContextError('login_required', 401)` when
unauthenticated. `routes.mjs` uses `user.user_id` to resolve the tenant and is unchanged.

## 5. Database client & secrets

- Add the dependency to the Worker package: `npm i @supabase/supabase-js` (Wrangler bundles it;
  the `npm:@supabase/supabase-js@2.57.4` Deno specifier is not used).
- Store `SUPABASE_URL` and the key as **Worker secrets** (`wrangler secret put …`), never in
  Git, never in the frontend, never as `VITE_*` (those are public at build time).

Two isolation models — **prefer the second on Cloudflare, because you now can:**

1. **Service-role key + application scoping** (what the snippets above show). The Worker uses
   `SUPABASE_SERVICE_ROLE_KEY` and every query is still scoped by `business_id`/`owner_user_id`
   in `routes.mjs`. Simple, but the DB itself does not enforce tenancy — a bug in scoping is
   not caught by the database. Keep RLS **on** with a deny-by-default policy as defense in depth.

2. **Per-request user JWT + RLS owner policies** (strongest). Forward the authenticated user's
   Supabase JWT when constructing the client so Postgres RLS enforces `auth.uid() = owner`:
   ```js
   const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
     global: { headers: { Authorization: `Bearer ${userAccessToken}` } },
     auth: { persistSession: false, autoRefreshToken: false },
   });
   ```
   With `owner` RLS policies (see [`DATABASE.md`](DATABASE.md)), a tenant physically cannot
   read/write another tenant's rows. **This removes the Qoder "anonymous adapter can't enforce
   RLS" limitation entirely** — it was a platform constraint, not an app design choice.

## 6. Routing `/functions/v1/app` on Cloudflare

`api.ts` calls the same-origin path `/functions/v1/app?action=…`. Keep it so the frontend is
untouched:

- **Worker + Static Assets (recommended):** one Worker serves the SPA and the API path
  (§1). Attach your custom domain to the Worker. `not_found_handling: "single-page-application"`
  gives the SPA fallback.
- **Pages + separate Worker:** deploy `dist/` to Pages, deploy the API as a Worker, and add a
  Pages Function at `functions/v1/app.ts` (Pages maps `functions/` → URL root) that forwards to
  the Worker via a **service binding**. More moving parts; use only if you want Pages' Git-based
  deploy pipeline.

## 7. Webhook must stay public

`whatsapp.webhook` is called by Meta's servers, not a logged-in user. Ensure:
- It is **excluded** from Cloudflare Access / any auth middleware.
- The Worker path routes it to `handleWebhook` (already public in `handler.mjs`).
- `META_APP_SECRET` is set so `X-Hub-Signature-256` is verified.

## 8. Local development on Cloudflare

```sh
npm i -D wrangler
# frontend + worker together (Workers Static Assets):
wrangler dev            # serves dist/ + /functions/v1/app locally on :8787
# secrets for local dev live in .dev.vars (gitignored), NOT in wrangler.jsonc
```
`.dev.vars`:
```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
AI_API_KEY=...
META_ACCESS_TOKEN=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...
```
The existing `dev/run-local.mjs` backend harness (in-memory Supabase fake, 36 assertions) still
runs under Node and is useful for logic regression tests independent of the Worker runtime.

## 9. Porting checklist

- [ ] Worker entry replaces `Deno.serve`/`serveSite` (§1).
- [ ] `adapter.mjs` not deployed; client built from Worker secrets (§2).
- [ ] `handler.mjs` takes `env` from the request context (§3).
- [ ] `auth.mjs` verifies **your** identity; no client-trusted id header (§4).
- [ ] `@supabase/supabase-js` installed as a normal dependency (§5).
- [ ] Secrets set via `wrangler secret put` (prod) and `.dev.vars` (local) (§5, §8).
- [ ] RLS enabled with owner policies; choose service-role vs per-request-JWT model (§5, DATABASE.md).
- [ ] `/functions/v1/app` routed; SPA fallback configured (§6).
- [ ] Webhook path public + signature verified (§7).
- [ ] `wrangler dev` passes the main flow; then deploy and re-verify on the real domain.
