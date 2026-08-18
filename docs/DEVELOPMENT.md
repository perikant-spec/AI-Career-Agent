# Development Guide

## Local development setup

### Prerequisites
- Node.js 20 (the codebase and CI both target Node 20; a newer LTS will emit `EBADENGINE` warnings from a few dependencies but currently still works)
- npm (the repo uses `package-lock.json`, not yarn/pnpm)

### First-time setup

```bash
npm install
npm run db:start      # spins up a real, persistent, local Postgres instance
                        # (no Docker or admin rights needed — see scripts/postgres-local.mjs)
cp .env.example .env   # then fill in DATABASE_URL if npm run db:start printed a different one
npx prisma migrate dev # applies the full migration history to your local database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and upload a resume (PDF or DOCX) to get into the product. See `docs/USER-GUIDE.md` for the full first-run walkthrough.

To stop the local database later: `npm run db:stop`.

### Optional: seed data

```bash
npm run db:seed
```

Runs `prisma/seed.ts` (`tsx prisma/seed.ts`) — creates a demo account with a resume already parsed, several scored jobs, and applications at different pipeline stages, so the product can be explored mid-use without going through onboarding. (Read `prisma/seed.ts` directly for the exact current seed data — this file changes independently of this document.)

### Optional: mobile app

```bash
cd mobile
npm install
npm run web      # Expo web target — runs in a real browser against the same backend
# npm run ios / npm run android — require Xcode or an Android emulator/SDK respectively
```

The mobile app has its own `package.json` and lockfile, and is typechecked as a separate CI job from the web app.

## Repository structure

```
app/                  Next.js App Router
  (app)/               Every authenticated product page (assistant, jobs, applications, ...)
  (auth)/              Login, register, forgot/reset password
  api/                 Backend Route Handlers — see docs/API.md for the full endpoint list
  dev/                 Development-only debug pages (design tokens, email outbox) — hard-blocked in production
  terms/, privacy/     Legal pages
components/            Shared React components, organized to mirror app/'s domains
  ui/                   Generic design-system primitives (buttons, cards, badges, ...)
lib/                   All business logic and external-service integrations — see docs/ARCHITECTURE.md
mobile/                Companion Expo/React Native app (own package.json, own CI job)
prisma/                schema.prisma, migrations/, seed.ts
tests/
  unit/                 25 files — pure/deterministic logic, no DB or network
  integration/           8 files — real Postgres + a real running server, no mocks
  fixtures/               Sample files used by tests (e.g. resume fixtures)
docs/                  This documentation set
scripts/               postgres-local.mjs, backup-db.mjs, smoke-test.mjs
.github/workflows/     ci.yml, daily-briefing-cron.yml
proxy.ts               Next.js 16's replacement for middleware.ts — route protection + API CORS
auth.ts / auth.config.ts   NextAuth v5 configuration
instrumentation.ts     Boot-time env validation + Next's onRequestError hook
Dockerfile             Multi-stage production build
docker-compose.yml     Local rehearsal only (not the production topology)
```

Inside `lib/`, each subdirectory is a self-contained domain module: `ai`, `analytics`, `application`, `assistant`, `auth`, `billing`, `briefing`, `evidence`, `followups`, `interview`, `jobs`, `legal`, `logging`, `mail`, `mobile`, `networking`, `profile`, `push`, `resume`, `resumeText`, `scoring`, `security`, `storage`, `text`, `time`, `types`, `validation` — plus standalone `env.ts` (boot validation) and `prisma.ts` (the Prisma client singleton).

## Development workflow

There is no separate "staging branch" workflow encoded in the repository itself beyond what `.github/workflows/ci.yml` runs against — CI triggers on push/PR to `main` and `development`. Day-to-day:

1. Make changes.
2. `npx tsc --noEmit` and `npm run lint` locally before pushing (CI will fail the same way otherwise).
3. Run the relevant test suite (see below).
4. Push and let CI validate; `deploy-gate` only runs on a push to `main` and requires every other job to have passed first.

## Coding conventions

These are patterns observed consistently across the codebase, not aspirational guidelines — each is backed by real, repeated examples (see `docs/ARCHITECTURE.md` §9 for the full list with file citations):

1. **Swap-point provider pattern** for every optional external service — one `getXProvider()`/`getXClient()` function is the only place that checks the relevant env var.
2. **Deterministic-computation-then-AI-only-explains** — numbers and structural decisions come from pure functions; an LLM, when configured, only phrases an already-final result.
3. **Pro-tier gates return `402` with `{ error, upgradeRequired: true }`**, checked server-side inside the route handler, never only in the UI.
4. **Cross-tenant access always 404s, never 403s** — never confirm-by-error-code that a resource exists for someone else.
5. **Route handlers are thin; logic lives in `lib/`**, further split into pure functions (unit-testable without a database) and thin async DB-wrapper functions that call them.
6. **Enum-like values are `String` columns validated against TypeScript unions in `lib/types/enums.ts`**, not native database enums (see `DATABASE.md`).

## Testing strategy

- **Framework**: [Vitest](https://vitest.dev/) (`vitest.config.mts`: `environment: "node"`, path alias `@` → repo root).
- **Unit tests** (`tests/unit/`, 25 files): pure/deterministic logic only — no database, no network, no running server. Covers the resume/job extraction heuristics, the Evidence Validator, the match scorer (every category weight, every disqualifier, exact tier boundaries), the assistant's intent classifier, timezone conversion math, and the daily-briefing narrative builder, among others.
- **Integration tests** (`tests/integration/`, 8 files): require a **real running server** and a **real Postgres database** — nothing is mocked. Each file uses `describe.runIf(await serverReachable())(...)` to skip cleanly (not fail) if no server is reachable at `E2E_BASE_URL` (default `http://localhost:3000`), checked via a real `GET /api/health` call. Test setup drives the app through its actual public HTTP API — registering real accounts via `/api/auth/register`, obtaining a real session cookie and a real mobile JWT — with direct Prisma calls used only for setup/assertions that have no corresponding API surface (e.g. granting a Pro subscription for a test).
  - Files: `aiCostControl`, `aiDataIsolation`, `candidateEvidenceEnforcement`, `dailyBriefing`, `fullWorkflow.e2e`, `privacyFoundation`, `storage.s3`, `tenantIsolation` (plus a `helpers/` folder of shared test utilities).
  - `tenantIsolation.test.ts` is the IDOR/multi-tenant regression suite: it builds one user's full data footprint, then asserts a second user gets `404` on every cross-tenant access attempt.

Commands:

```bash
npm test               # everything, one-shot
npm run test:unit       # unit only, no server/DB needed
npm run test:integration # requires: npm run db:start, then npm run dev in another terminal
npm run test:watch      # watch mode
```

To run integration tests locally, you generally also want `RATE_LIMIT_DISABLED=true` in your `.env` (see `.env.example`) — otherwise the auth rate limits will block the many-accounts-in-a-loop pattern several integration tests use. **Never set this outside local development/CI.**

## Build process

```bash
npm run build   # next build, output: "standalone" (see next.config.ts)
npm run start   # runs the production build locally
```

`npx prisma generate` must run before a build in any fresh environment (CI does this explicitly; local `npm install` triggers it automatically via the `prisma` postinstall hook if configured, otherwise run it manually — see `package.json`'s `prisma.seed` config and the `@prisma/client` dependency).

## CI pipeline (`.github/workflows/ci.yml`)

Runs on every push/PR to `main` and `development`. Nine jobs:

| Job | What it does |
|---|---|
| `typecheck` | `npx tsc --noEmit` against the web app |
| `mobile-typecheck` | `npx tsc --noEmit` inside `mobile/`, separate lockfile cache |
| `lint` | `npm run lint` (ESLint) |
| `unit-tests` | `npm run test:unit` — no external services |
| `integration-tests` | Spins up a real `postgres:16` service container, runs `prisma migrate deploy`, builds and starts the app (`next start`), polls `/api/health` until ready, then `npm run test:integration` |
| `security-checks` | `npm audit` (production deps, then full) — **informational only, never fails the build** (`\|\| true`) |
| `build` | Plain `next build` validation |
| `docker-build` | A real `docker build` via `docker/build-push-action@v6` (build-only, no push) — the actual verification that the Dockerfile's multi-stage/standalone/Prisma-binary setup works in a real container environment |
| `deploy-gate` | Only on push to `main`; requires every job above except `security-checks` to have passed. Currently a placeholder echo — no hosting target is wired up yet (see `docs/DEPLOYMENT.md`) |

There is a second, separate workflow — `.github/workflows/daily-briefing-cron.yml` — that fires hourly against `POST /api/cron/daily-briefing`. It is currently inert: the `APP_URL`/`CRON_SECRET` repository secrets it needs don't exist until the app has a real deployment.

## Deployment process

Full runbook: **[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)**. In summary: no hosting platform has been chosen yet (Vercel, a container PaaS via the included `Dockerfile`, and self-hosted VPS via `docker-compose.yml` are all documented as options); provisioning steps for Postgres and S3-compatible storage; environment variables enforced at boot by `lib/env.ts`'s `assertProductionSafety()`; `prisma migrate deploy` is a manual release step, deliberately **not** run automatically by the container on every boot (unsafe with more than one replica); and a post-deploy smoke test script (`npm run smoke-test`).

## Environment variables

See `.env.example` (local dev template) and `.env.staging.example`/`.env.production.example` (stricter templates matching `assertProductionSafety()`'s enforcement). Summary:

**Required everywhere**: `DATABASE_URL`, `AUTH_SECRET` (generate with `npx auth secret`) — the app fails to boot immediately with a clear error if either is missing.

**Required in production only** (enforced by `assertProductionSafety()` when `APP_ENV=production`): a non-localhost `DATABASE_URL`/`AUTH_URL`, `S3_BUCKET` (+ region/keys), and `RATE_LIMIT_DISABLED` must **not** be set to `true`.

**Optional, each independently unlocking real functionality** (the app runs correctly with none of them set):

| Variable(s) | Unlocks |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Real Claude-backed extraction/scoring-rationale/assistant text instead of the offline heuristic mock |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | Real object storage instead of local disk |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | Real Pro-plan billing instead of Free-tier-only |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Licensed job-search API import, in addition to manual paste |
| `AI_FREE_DAILY_BUDGET_USD`, `AI_PRO_DAILY_BUDGET_USD` | Override the default per-user daily AI-spend caps |
| `RESEND_API_KEY` | **Present in `.env.example` as a documented next step, but no code branch currently reads it** — see `KNOWN-ISSUES.md`. Real email sending requires adding a provider branch to `lib/mail/index.ts` first. |
| `EXPO_PUSH_DISABLED` | Set `true` in local dev/tests to avoid firing real device push notifications |
| `CRON_SECRET` | Required to call `/api/cron/daily-briefing` |
| `RATE_LIMIT_DISABLED` | Local dev/CI only — disables rate limiting so integration tests can register many accounts quickly |

## Troubleshooting

- **App won't boot, error mentions `DATABASE_URL` or `AUTH_SECRET`**: these two are the only vars validated at boot (`lib/env.ts`, run from `instrumentation.ts`) — copy `.env.example` to `.env` and fill them in.
- **App refuses to boot with "Refusing to boot with APP_ENV=production..."**: this is `assertProductionSafety()` — check the four things it validates (real `DATABASE_URL`/`AUTH_URL`, `S3_BUCKET` set, `AUTH_SECRET` long enough, `RATE_LIMIT_DISABLED` unset) in that order.
- **Integration tests all skip silently**: `describe.runIf(await serverReachable())` couldn't reach `E2E_BASE_URL` — make sure `npm run dev` (or `npm run start` against a built app) is actually running, and that `npm run db:start` was run first.
- **Integration tests fail on the 5th/6th account registration**: you likely don't have `RATE_LIMIT_DISABLED=true` set locally — the real auth rate limits are active by default.
- **`prisma generate` fails even for read-only commands**: `prisma.config.ts` eagerly reads `env("DATABASE_URL")` at config-load time (it never actually connects for `generate`) — this var must be set even to run `tsc`/`lint`/`test:unit` in a fresh CI-like environment, which is why those CI jobs set a placeholder `DATABASE_URL` even though they never touch a real database.
- **A deleted test account still seems to "exist" via an old token/cookie**: this was a real bug, already fixed — `resolveUserId` now re-checks the user row still exists on every call, not just that the token/cookie is cryptographically valid.
- **Mobile app can't reach the backend from a physical device or Android emulator**: `localhost` in `EXPO_PUBLIC_API_URL` only works for the Expo *web* target and iOS Simulator; a physical device or Android emulator needs your machine's LAN IP (Android emulator specifically: `10.0.2.2`).
