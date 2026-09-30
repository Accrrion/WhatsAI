# WhatsAI on Cloudflare — Documentation Set

> Temporary product name. The brand is centralized in `lib/config.ts` (`BRAND`); rename it
> there to rebrand. Nothing in this doc set is Cloudflare-account-specific.

This is a **parallel copy** of `docs/` rewritten for deploying WhatsAI on **Cloudflare**
instead of Qoder Sites. The application code is the same React SPA + `functions/` backend;
what changes is the **runtime, the database ownership, and the identity model**.

Read these in order:

| Doc | What it covers |
| --- | --- |
| [`PORTING.md`](PORTING.md) | **Start here.** The exact code changes to move `functions/` from Deno/Qoder to a Cloudflare Worker. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Step-by-step: Supabase/Neon Postgres → Worker → Pages → secrets → custom domain → WhatsApp callback. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Target topology and how it differs from the Qoder deployment. |
| [`DATABASE.md`](DATABASE.md) | Postgres on your own provider, **with real RLS** (removes the Qoder isolation limitation). |
| [`SECURITY.md`](SECURITY.md) | Your own auth (Cloudflare Access or JWT/session), server-only secrets, RLS. |
| [`API.md`](API.md) | The unchanged action contract + where it is served on Cloudflare. |
| [`AI.md`](AI.md) | AI engine — identical logic, env bindings instead of `Deno.env`. |
| [`WHATSAPP.md`](WHATSAPP.md) | Meta Cloud API integration; callback URL on your domain. |
| [`ROADMAP.md`](ROADMAP.md) | Phased plan, adjusted for the Cloudflare path. |
| [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) | Section-51 style status report for the Cloudflare target. |
| [`PROGRESS.md`](PROGRESS.md) | Living TODO tracker for the Cloudflare port + infrastructure. |
| [`schema.sql`](schema.sql) | Full DDL. On a self-managed Postgres you may extend it (FKs, defaults, RLS). |
| [`PROVENANCE.md`](PROVENANCE.md) | Starter-template attribution/license (platform-agnostic; copied verbatim). |

## Why the docs differ from `docs/`

The Qoder Sites deployment is constrained by its platform. Cloudflare removes three of those
constraints and adds one responsibility:

1. **Custom domains work.** Cloudflare Pages/Workers serve your own `yourdomain.com`
   (Qoder Sites is fixed to `*.qoder.website`).
2. **You own the database**, so you can enable **real row-level security** with per-tenant
   `owner` policies. The Qoder "anonymous adapter can't enforce RLS" limitation
   (`docs/SECURITY.md` §Isolation) **does not apply here** — fix it, don't port it.
3. **No `x-instance-id` / injected Supabase credentials.** The Qoder gateway injects tenant
   routing and DB keys. On Cloudflare you supply your own Postgres URL + key as Worker
   secrets, and the bundled `functions/adapter.mjs` must be **replaced**, not reused.
4. **You must provide identity.** Qoder injects a verified `x-qoder-user-context` header and
   `functions/auth.mjs` trusts it. Cloudflare does **not**. You must add your own trusted
   auth (Cloudflare Access JWT, Supabase Auth, Clerk, Auth.js, or your own session) and
   rewrite `requireUser()` to derive `user_id` from it. **This is the single most important
   porting task** — the entire multi-tenancy model depends on a server-verified identity.

## What stays the same

- The React frontend (`dist/`) is unchanged and deploys to Pages as-is.
- `api.ts` still calls `/functions/v1/app?action=...`; keep that path so the frontend needs
  no edits (see [`DEPLOYMENT.md`](DEPLOYMENT.md) for routing it to the Worker).
- All ~40 tenant-scoped actions, the AI orchestrator, tools, grounding rules, WhatsApp
  webhook logic, and the labeled in-browser demo fallback are unchanged.
- The security invariants from the master build prompt still hold and are **stronger** here:
  never trust `businessId`/`userId` from the client, never put secrets in Git or the
  frontend, never expose DB credentials, and the AI never fabricates prices/stock/policies/
  order or payment status.

## Minimum viable Cloudflare deploy

Frontend-only on Pages (no Worker) works immediately and runs on the **labeled demo data**
— good for a public marketing/demo site with a custom domain. A real multi-tenant SaaS
needs the Worker + Postgres + auth port in [`PORTING.md`](PORTING.md).
