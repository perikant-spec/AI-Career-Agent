# Deployment Runbook

Staging/production infrastructure prep for the AI Career Agent. This app has three external
dependencies that must exist before any deploy: a Postgres database, S3-compatible object
storage, and (optionally) an Anthropic API key/Stripe account/email provider. Everything else is
the Next.js app itself, deployable as a standard container (`Dockerfile`) or directly from git on
a platform that builds Next.js natively.

No hosting platform has been chosen yet — this runbook covers the decision and every path from
it, rather than assuming one.

## 1. Choose a host

| Option | Deploy method | Notes |
|---|---|---|
| **Vercel** | git push, zero config | Built by the Next.js team; ignores the `Dockerfile` entirely and manages its own build via the Build Output API. `next.config.ts` disables `output: "standalone"` specifically when `process.env.VERCEL` is set, since Vercel's build does not tolerate that option (confirmed by a real deployment failure — it broke Vercel's own trace-file step). Postgres/S3/everything else still external. |
| **Railway / Render / Fly.io** | `Dockerfile` (this repo has one) | Container PaaS; Railway and Render can also host the Postgres instance alongside the app. |
| **Self-hosted / VPS** | `Dockerfile` + `docker-compose.yml` + a reverse proxy | Most setup, most control. Needs your own TLS termination (Caddy or nginx) in front of the container. |

Whichever you pick, the app itself doesn't change — only how the container/build gets triggered
and where env vars get set.

## 2. Provision Postgres

Any real Postgres 14+ works — `DATABASE_URL` is a standard connection string
(`lib/prisma.ts` / `prisma/schema.prisma`). Managed options: Neon, Supabase, Railway Postgres,
Render Postgres, RDS. Whichever you use:

- Enable connection pooling if the platform doesn't already sit one in front of Postgres for you
  (`?connection_limit=10&pool_timeout=20` in the connection string is what `.env.example` already
  documents; PgBouncer/Prisma Accelerate for high-concurrency serverless deployments).
- **Staging and production must be separate database instances.** Never point staging at the
  production database "temporarily" — there is no automated safeguard against that today beyond
  this being a manual step you control.

## 3. Provision object storage

Any S3-compatible endpoint works (`lib/storage/s3.ts`): AWS S3, Cloudflare R2, Backblaze B2.
Create a **private** bucket (never public-read — the app only ever issues signed URLs, see
`lib/storage/s3.ts`'s own comments) — one bucket per environment, not shared between
staging and production.

## 4. Set environment variables

Start from `.env.staging.example` or `.env.production.example` (this repo, root) — copy it into
your host's environment-variable configuration (Vercel/Railway/Render/Fly all have a dashboard or
CLI for this; a VPS gets a real `.env` file that is **never committed**, matching `.gitignore`).

Every variable in the production template is enforced at boot by `lib/env.ts`'s
`assertProductionSafety()` whenever `APP_ENV=production`: a localhost `DATABASE_URL`/`AUTH_URL`,
a missing `S3_BUCKET`, a short/missing `AUTH_SECRET`, or `RATE_LIMIT_DISABLED=true` will make the
container **refuse to start** rather than silently serve traffic against dev-shaped config. This
is deliberate — if the app won't boot, check those four things first, in that order.

Set `APP_ENV=staging` for staging (same production-grade Next.js build, but exempt from the
checks above — see `.env.staging.example` for what staging is still expected to do: its own DB,
its own bucket, never production credentials).

Generate `AUTH_SECRET` per environment with:

```bash
npx auth secret
```

## 5. Build and deploy the container (Railway/Render/Fly/VPS path)

The `Dockerfile` in this repo builds a `output: "standalone"` Next.js image (see its own
comments for exactly what's verified vs. what still needs a real Docker environment to confirm —
this repo's own dev sandbox has no Docker installed, so `docker build`/`docker run` themselves
have not been exercised, only the underlying `next build --> .next/standalone/server.js` boot
path they package, which has been verified directly).

```bash
docker build -t ai-career-agent .
```

Most platforms (Railway, Render, Fly) detect the `Dockerfile` automatically from a git push — no
separate build step needed beyond pointing the platform at this repo.

For a **VPS**: run `docker compose up --build -d` (see `docker-compose.yml` — note that file is
for *local rehearsal* against a throwaway Postgres/minio, not itself the production topology; a
VPS deploy should point `DATABASE_URL`/`S3_*` at the real managed services from steps 2–3, not the
compose file's local containers) behind a reverse proxy (Caddy is the least config for automatic
TLS; nginx if you need more control).

## 6. Run migrations

Migrations are a **release step, not something the container does on every boot** — running
`prisma migrate deploy` automatically in the container's `CMD` is unsafe the moment there's more
than one replica starting concurrently. Run it once, before traffic is routed to new containers:

```bash
DATABASE_URL="<real connection string>" npx prisma migrate deploy
```

Most PaaS platforms have an explicit "release command" or "pre-deploy command" hook for exactly
this (Railway, Render, Fly all do) — use it if available rather than a manual step.

## 7. Post-deploy smoke test

```bash
BASE_URL=https://your-staging-url.example.com node scripts/smoke-test.mjs
```

Checks: health endpoint reports `{status: "ok", database: "ok"}`, a real signup completes and
persists, `/terms`/`/privacy` render, then cleans up the test account it created. See
`scripts/smoke-test.mjs` for exactly what it does — it's deliberately narrow (this is a boot/wiring
check, not the full test suite; that's what CI's integration-tests job is for).

## 8. Rollback

Container-based platforms (Railway/Render/Fly): redeploy the previous image/commit from the
platform's own deploy history. Vercel: "Promote to Production" on the previous deployment in its
dashboard. In both cases, only roll back the app — never roll back a database migration
automatically; a schema rollback needs its own reviewed migration, same as a forward one.
