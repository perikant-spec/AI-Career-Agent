# AI Career Agent

An AI career agent that manages the mechanics of a job search — resume parsing, career-profile
extraction, job import, match scoring, job-specific resume tailoring, full application
preparation (cover letter, screening answers, tracker), networking outreach drafts, follow-up
reminders, interview preparation (with real, timezone-aware interview scheduling), a proactive
daily briefing, and a central assistant that ties all of it together with real analytics — built
around an evidence layer that never lets an AI-generated claim about the candidate outrun what
their resume actually says, and a hard human-in-the-loop boundary: the agent prepares, the user
sends. Nothing in this codebase submits an application or sends a message on the user's behalf.

Full documentation lives in [`docs/`](docs/) — see the [Documentation](#documentation) section
below for what's where. This file covers what you need to install, run, and test the app.

## Main capabilities

- **Resume parsing → evidence-backed Career Profile** — PDF/DOCX upload, extracted into
  Verified / Supported-inference / Not-verified / Missing entries; a claim's confidence can be
  downgraded on re-check but never upgraded.
- **Job import & match scoring** — manual paste (always available) or the licensed Adzuna API
  (optional); a deterministic, weighted scorer (no LLM in the numbers) produces a tier from
  `Apply Strong` to `Don't Apply`, including hard disqualifiers.
- **Resume customization & full application packages** — tailored resume, cover letter, and
  screening Q&A per job (Pro), grounded only in what the profile already contains.
- **Application tracking** — a 13-stage pipeline (Kanban + list view); every status change is
  explicit, including the one button that marks an application `Applied`.
- **Networking & outreach drafting** — user-supplied contacts only (no auto-discovery); six
  drafted message types (Pro); "mark as sent" is a manual confirmation, nothing is actually sent
  by the app.
- **Follow-up reminders** — auto-scheduled on `Applied`, with an AI-drafted check-in message.
- **Interview preparation** — auto-built prep workspace (Pro) with company research, STAR-format
  question bank, mock-answer scoring, and a real, timezone-aware `scheduledAt` interview time.
- **Central AI Assistant** — a chat interface routing to scoped, DB-backed tools; never
  free-generates a claim about the user's data.
- **Daily Briefing** — a deterministic daily summary (new matches, high-priority jobs, follow-ups
  due, a contact worth reaching out to, next interview) shown as an in-app card on web and mobile,
  plus a real push notification on mobile (opt-in).
- **Billing** — Stripe-backed Free/Pro subscription with server-side entitlement gates.
- **Mobile app** — a real Expo/React Native app (not a WebView) sharing this backend and
  database; see [Current Limitations](docs/PRODUCT.md#current-limitations) for its feature gaps
  versus web.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) for the full feature-by-feature status table, and
[`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) for a walkthrough of how to actually use each one.

## Technology stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL, via Prisma ORM (`@prisma/client`)
- **Auth**: Auth.js (NextAuth) v5 for web sessions; a separate signed-JWT Bearer flow
  (`jose`) for the mobile app
- **AI**: Anthropic Claude (`@anthropic-ai/sdk`), behind a swap-point provider — the app runs
  fully offline on a deterministic heuristic mock if no API key is set
- **File parsing**: `pdf-parse`, `mammoth` (DOCX)
- **Object storage**: local disk by default; `@aws-sdk/client-s3` for S3-compatible storage
  (real AWS S3, Cloudflare R2, etc.) when configured
- **Billing**: Stripe (`stripe`)
- **Push notifications**: Expo push service (`expo-server-sdk`)
- **Mobile**: Expo / React Native (TypeScript), in `mobile/`
- **Testing**: Vitest (`tests/unit/`, `tests/integration/`)
- **CI**: GitHub Actions (typecheck, lint, unit tests, integration tests, security checks, build,
  Docker build, deploy gate)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how these fit together, and
[`docs/DATABASE.md`](docs/DATABASE.md) for the full schema.

## How to install

```bash
git clone <this-repo>
cd "AI Career Agent"
npm install
```

Node 20+ is required (the app relies on full ICU support in `Intl`, shipped by Node 20+, for
timezone handling — see `lib/time/`).

## How to run locally

```bash
npm run db:start   # starts a real, local, persistent PostgreSQL instance — no Docker or admin rights needed
cp .env.example .env
# generate a real AUTH_SECRET into .env:
npx auth secret
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and upload a resume
(PDF or DOCX — scanned/image-only files aren't supported; add entries manually via the Career
Profile page instead).

`DATABASE_URL` (pointed at the instance `db:start` just created) and `AUTH_SECRET` are the only
two required environment variables — the app validates them at boot and fails fast with a clear
error if either is missing. Everything else is optional; see
[Environment variables](#environment-variables) below.

### Optional: seed a demo account

```bash
npm run db:seed
```

Creates `demo@example.com` / `demo12345` with a resume already parsed into a Career Profile,
three scored jobs at different pipeline stages (including one with a full application package
generated and approved, and one with interview prep built), and a networking contact with a
drafted message — a way to see the product mid-use without going through onboarding yourself.

### Optional: enable the mobile app

```bash
cd mobile
npm install
npm run web      # Expo web target
# npm run ios / npm run android — require Xcode / an Android emulator
```

The mobile app talks to the same Next.js backend (`npm run dev` must be running) via a separate
Bearer-token auth flow — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#6-authentication--authorization).

## Environment variables

Only `DATABASE_URL` and `AUTH_SECRET` are required to run the app; every optional variable below
unlocks one specific piece of functionality and is otherwise inert with an honest
"not configured" fallback rather than a silent failure. Full details and defaults are commented
in [`.env.example`](.env.example); the same table also appears in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#environment-variables) alongside staging/production
requirements.

| Variable | Required? | Unlocks |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection |
| `AUTH_SECRET` | Yes | Session/JWT signing |
| `AUTH_URL` | Local dev default provided | Auth.js callback base URL |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | No | Real Claude extraction/scoring-rationale/assistant calls (default: offline heuristic mock) |
| `AI_FREE_DAILY_BUDGET_USD` / `AI_PRO_DAILY_BUDGET_USD` | No | Per-user daily AI-spend ceiling |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | No | Licensed Adzuna job-search import |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT` | No | S3-compatible file storage (default: local disk) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | No | Real Stripe billing (default: everyone on Free) |
| `RESEND_API_KEY` | No | Documented for a future email provider — **no code currently reads this**, see [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) |
| `EXPO_PUSH_DISABLED` | No | Set `true` to fall back to console/log push in local dev or tests |
| `CRON_SECRET` | Only to exercise the daily-briefing cron route | Authorizes `POST /api/cron/daily-briefing` |
| `RATE_LIMIT_DISABLED` | Test/CI only | Disables rate limiting (no-op outside local dev/CI) |

## How to test

```bash
npm test              # everything, one-shot
npm run test:unit      # pure/deterministic logic only — no DB, no network
npm run test:integration  # real Postgres + a real running server required
npm run test:watch
```

Unit tests cover extraction heuristics, the Evidence Validator, the match scorer, timezone/DST
math, briefing fact computation, and the assistant's intent classifier. Integration tests exercise
real routes against a real database, including a tenant-isolation sweep that checks every
user-scoped route returns `404` (never `403`) for another user's resource. See
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#testing-strategy) for the full breakdown and CI
pipeline.

## How to build/deploy

```bash
npm run build
npm start
```

`npm run build` runs `next build` (which also runs `prisma generate`). Docker, staging/production
environment requirements, and the deployment runbook are documented in full in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — as of this writing, no hosting platform has actually
been deployed to; that document describes the prepared infrastructure, not a live instance.

## Documentation

| Document | Contents |
|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Purpose, target users, user roles, user journeys, feature status table, business rules, current limitations |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Frontend/backend architecture, data flow, auth, external services, AI components, key decisions |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Local setup, repo structure, conventions, testing strategy, CI, troubleshooting |
| [`docs/API.md`](docs/API.md) | Every API route, method, auth requirement, request/response shape |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema, models, relationships, indexes, migrations |
| [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) | How to actually use the app, by feature |
| [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) | Verified incomplete functionality, technical debt, security-relevant items |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker, staging/production setup, deployment runbook |
