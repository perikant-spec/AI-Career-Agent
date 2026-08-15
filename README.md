# AI Career Agent

An AI career agent that manages the mechanics of a job search — resume parsing, career-profile
extraction, job import, match scoring, job-specific resume tailoring, full application
preparation (cover letter, screening answers, tracker), networking outreach drafts, follow-up
reminders, interview preparation, and a central assistant that ties all of it together with
real analytics — built around an evidence layer that never lets an AI-generated claim about the
candidate outrun what their resume actually says, and a hard human-in-the-loop boundary: the
agent prepares, the user sends.

This is the **complete 13-milestone roadmap**: Resume → Career Profile → Job Import → Match Score
→ Resume Customization → Application Workspace → Networking & Outreach → Follow-Up Engine →
Interview Preparation → Central AI Assistant → Mobile (React Native/Expo) → Billing (Stripe) →
Production Hardening. See `MILESTONE ROADMAP` below for status and honest-degradation notes on
anything that's inert until you supply your own third-party credentials.

## Getting started

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db (SQLite) and applies the schema
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and upload a resume
(PDF or DOCX — scanned/image-only files aren't supported yet, paste the text instead).

### Optional: seed a demo account

```bash
npm run db:seed
```

Creates `demo@example.com` / `demo12345` with a resume already parsed into a Career Profile,
three scored jobs (a strong match, a certification-disqualified one, and a sparse posting), and
a tracker seeded across three pipeline stages — the strongest match has a full application
package (resume, cover letter, Q&A) generated and approved, sitting at Ready to Apply, plus a
user-supplied contact with a drafted connection-request message; the second application is
backdated 10 days into Screening so its auto-scheduled follow-up shows up overdue; the third
(the intentionally sparse posting) is at Interview stage with a full prep workspace generated —
a good demo of honest degradation, since its company-research panel and motivational answers
come back empty rather than fabricated. So you can see the product mid-use without going through
onboarding yourself.

### Optional: real AI instead of the built-in heuristic mock

By default this runs **fully offline** — resume/job extraction and match rationale text are
produced by a genuine heuristic engine (section-header parsing, a curated skills taxonomy,
date-range parsing — not random placeholder text), gated by the same deterministic Evidence
Validator either way. To switch to real Claude-backed extraction, copy `.env.example` to `.env`
and set:

```
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-5"   # optional, this is the default
```

No other code changes are needed — `lib/ai/index.ts#getAIProvider()` is the only place that
checks which provider is active.

### Optional: a real licensed job source (Adzuna)

Manual paste/URL import always works. To also enable pulling from Adzuna's licensed job-search
API (free self-serve signup at [developer.adzuna.com](https://developer.adzuna.com/)), set:

```
ADZUNA_APP_ID="..."
ADZUNA_APP_KEY="..."
```

Until both are set, the Settings page shows Adzuna as "Not connected" and the import endpoint
returns `{configured: false}` rather than silently doing nothing.

## Running tests

```bash
npm test          # one-shot
npm run test:watch
```

Unit tests cover the pure/deterministic logic: resume- and job-extraction heuristics, the
Evidence Validator, the match scorer (every category, every disqualifier, exact tier
boundaries), and the assistant's intent classifier.

## Architecture notes

- **Evidence layer** (`lib/evidence/validator.ts`): every candidate-facing claim is
  Verified/Supported-inference/Not-verified/Missing, enforced by a deterministic
  substring/fuzzy-match check against the actual source text — not a second LLM call asked to
  self-certify. It can only ever downgrade a claim, never upgrade one.
- **Match Scorer** (`lib/scoring/`): pure, deterministic, zero LLM involvement in the numbers.
  8 weighted categories plus independent hard disqualifiers that force Don't Apply regardless
  of score. The AI provider is only ever asked to phrase the already-final numbers into prose.
- **Resume Customizer** (`lib/resume/`): deterministic selection/reordering — the only thing
  that decides which skills/bullets appear, so "no new entity introduced" is structural, not a
  prompt instruction. A curated synonym list handles ATS term adaptation ("customer support" →
  "client success", same verified work). The AI provider is asked for exactly one thing — a
  rephrased summary sentence built from what the deterministic pass already picked — and its
  citation is checked before anything from it is kept. ATS before/after scores are computed the
  same deterministic way on both sides, so the delta always reflects a real, disclosed mechanism
  (keyword prominence + term adaptation), never a fabricated improvement.
- **Application Workspace** (`lib/application/`): cover letter and Q&A generation reuse the same
  deterministic facts the resume customizer computes (`buildApplicationFacts` wraps
  `buildDeterministicCustomization`) — one shared, tested notion of "what's actually relevant to
  this job," not three separate ad-hoc heuristics. Every Application enters the tracker at
  Discovered the moment a job is scored; "Prepare application" generates whatever's missing and
  moves it to Preparing. A resume/cover-letter/Q&A piece can only reach Ready to Apply once the
  user has explicitly approved all three — nothing is ever auto-approved. "I applied on the
  employer's site" is the only thing that sets status to Applied; there is no code path that sets
  it any other way. Status changes elsewhere in the tracker (Kanban or List) are a plain dropdown,
  not drag-and-drop — same "user-driven, never silent" rule, less to get wrong.
- **AI provider abstraction** (`lib/ai/`): a single interface with a real heuristic mock and a
  Claude-backed implementation behind it — see `getAIProvider()`.
- **Assistant orchestrator** (`lib/assistant/`): a heuristic intent classifier routes chat
  messages to scoped, DB-backed tool functions; the AI provider only phrases those results into
  prose, never free-generates a claim about the user's data.
- **No scraping, ever.** Job import is manual paste/URL or the licensed Adzuna API — nothing
  else is fetched server-side.
- **Password reset** (`lib/auth/passwordReset.ts`): single-use, bcrypt-hashed, 1-hour-expiring
  tokens — same rule as passwords, the raw token is never stored. The forgot-password endpoint
  responds identically whether or not the email is registered, so it can't be used to enumerate
  accounts. Email delivery goes through the same pluggable-provider pattern as the AI/job-source
  layers (`lib/mail/`): no SMTP/Resend credentials exist in this environment, so the default
  provider logs to `/dev/outbox` (hard-`notFound()`-guarded outside development) instead of a
  silent no-op — a real, working default, not fake functionality.
- **Networking & Outreach** (`lib/networking/`): contacts are always user-supplied — no scraping,
  no licensed-enrichment auto-discovery (needs an account we can't create on the user's behalf),
  and no AI-inferred guess at who the hiring manager is or why they're relevant. The "why" is the
  user's own `relationshipNote`, never a generated claim. Outreach messages reuse the same
  `buildApplicationFacts` grounding as cover letters, with the same citation gate. "Mark as sent"
  is the only path to a SENT status, and no code path anywhere actually dispatches a message —
  the user copies it out and sends it themselves.
- **Follow-Up Engine** (`lib/followups/`): a fixed-offset timer (user-configurable in Settings,
  default 7 days), not a smart/adaptive schedule — response-rate-informed timing is explicitly a
  later phase. Auto-scheduled the moment an application first becomes Applied (idempotent — never
  duplicates on repeated transitions), never on any other status change. "Due" is computed at
  read time (`dueDate <= now`) rather than by a background job, since none exists in this build.
  The drafted check-in message states the real days-since-applied fact but never speculates about
  *why* there's been no response — that would be an invented claim about the employer's process.
- **Interview Preparation** (`lib/interview/`): auto-built the moment an application first
  reaches Interview or Final Interview. Company research is deterministically extracted from the
  job posting's own text (mission/team/stack mentions) — no web research capability exists, and
  asking an LLM to recall company facts from memory risks confident hallucination, so this stays
  pure text extraction and is honestly empty when nothing matches, never invented. STAR answers
  are entirely deterministic too, not AI-generated: Situation comes from the resume's own
  verified company/title/dates, Action/Result are mechanically split from a cited bullet's own
  text (Result only populated when a real metric is extractable), and Task is left null rather
  than padded out, since the resume doesn't separately capture task-scope from action. The one
  AI call in this milestone — mock-interview scoring — grounds itself only in the question and
  the response text the user just typed, never claiming anything about the candidate beyond that.
- **Central AI Assistant** (`lib/assistant/`): the orchestrator now routes across every module
  built so far — resume/application status, networking contacts, interview readiness, and a
  funnel-and-averages read on the whole job search. Three new intents (`FIND_CONTACT`,
  `PREPARE_FOR_INTERVIEW`, `WHY_NOT_HEARING_BACK`) follow the same scoped-tool pattern as the
  originals — each maps to one DB-backed function, never a free-form generation. The
  "why am I not hearing back" analysis (`lib/assistant/intents/whyNotHearingBack.ts`) is pure
  funnel math with no AI call at all, and explicitly refuses to compare match-score groups unless
  both groups have at least 2 data points — otherwise it says plainly that there's not enough
  data yet, per the PRD's "avoid false precision" rule. The new Analytics page
  (`lib/analytics/`) is the same philosophy: funnel counts and averages are direct aggregates,
  labeled as *current-status* snapshots rather than a true historical cumulative funnel, since
  this app doesn't log status-change history and won't claim to know more than that.

## Billing (`lib/billing/`)

Stripe-backed subscriptions with a Free/Pro entitlement model, built entirely behind the same
"honest not-configured default" pattern as the AI provider and Adzuna — inert with a real,
non-broken Free-tier product until you add your own Stripe keys.

- **Free plan**: profile, resumes, up to 5 tracked jobs, match scores, assistant Q&A. **Pro**:
  unlimited jobs plus application-package generation, networking outreach drafting, and interview
  preparation. Gates live in `lib/billing/entitlements.ts` (`assertJobImportAllowed`,
  `assertProFeature`) and are enforced server-side in every relevant route — never only in the
  UI — returning `402` with `{ upgradeRequired: true }` so both the web app and mobile app can
  show a consistent "Upgrade to Pro" prompt. Content already generated before a downgrade (e.g.
  interview prep built while Pro) is still shown; only *new* generation is gated.
- **Stripe Checkout + Billing Portal**, no Stripe.js/publishable key needed — `/api/billing/checkout`
  creates a Checkout Session and redirects there; `/api/billing/portal` opens the Stripe-hosted
  portal for the user to manage or cancel their own subscription directly (this app never cancels
  billing on a user's behalf). Both return a clean JSON error (never a raw 500) if the Stripe call
  itself fails, e.g. a misconfigured key.
- **Webhook is the only writer of entitlements** (`/api/billing/webhook`, synced via
  `lib/billing/syncSubscription.ts`): signature-verified against the raw body, subscribed to
  `customer.subscription.{created,updated,deleted}`. No client-facing route ever sets
  `plan`/`status` itself, so the DB can't drift from what Stripe actually thinks is true.
  Verified end-to-end (30 checks) using a fake-but-well-formed `STRIPE_SECRET_KEY`/
  `STRIPE_WEBHOOK_SECRET` and the Stripe SDK's own `webhooks.generateTestHeaderString` to sign
  test events locally — no real Stripe account needed to prove the signature verification and
  DB-sync logic actually work, only to accept real payments.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID` in `.env` to go
  live; Settings shows "Stripe not connected" and Free-tier limits apply to everyone until then.

## Production hardening

- **Security headers** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` always on; a strict `Content-Security-Policy` and HSTS
  are production-only, since a real CSP breaks `next dev`'s eval-based HMR.
- **Env validation at boot** (`lib/env.ts`, run from `instrumentation.ts#register`): a missing
  `DATABASE_URL`/`AUTH_SECRET` fails the process immediately with a clear message instead of
  surfacing as a confusing downstream error later. Optional integrations (Anthropic/Adzuna/Stripe)
  are deliberately excluded — the app runs correctly without any of them.
- **Rate limiting** (`lib/security/rateLimit.ts`): in-memory fixed-window limiter on every
  credential-guessable endpoint (login — both NextAuth and mobile —, register, forgot-password,
  reset-password, account deletion). Single-instance MVP limitation by design (same pattern as
  the Follow-Up Engine's fixed timer) — a multi-instance deployment needs a shared store
  (Redis/Upstash) instead, since each instance would otherwise keep independent counters.
- **Centralized error observability**: `app/error.tsx` / `app/global-error.tsx` / `app/not-found.tsx`
  give every route a real fallback UI instead of Next's default error screen; `instrumentation.ts`
  exports `onRequestError`, Next's single hook for every otherwise-uncaught Server
  Component/Route Handler/Middleware error, routed through `lib/logging/` (structured JSON,
  console-based today, same pluggable-provider pattern as AI/mail/billing — swap in
  Sentry/Axiom/Datadog later behind their own env var).
- **`GET /api/health`**: unauthenticated, checks actual DB connectivity (not just "the process is
  running") — for deployment platforms and uptime monitors.
- **Self-service data export & account deletion** (`/api/account/{export,route}`): export returns
  every user-owned row as JSON (secrets and raw file bytes excluded); deletion is
  password-confirmed and rate-limited, and relies on `onDelete: Cascade` already being set on
  every user-owned relation in `prisma/schema.prisma` — one `prisma.user.delete()` cleans up the
  entire DB side, plus a `storage.deleteAll(userId)` for the physical resume files. Wired into
  both the web Settings page and mobile Settings (delete only; export is web-only, since
  triggering a file download is meaningfully more complex on React Native).
- **Fixed a real bug this surfaced**: `resolveUserId` only checked that a token/cookie was
  cryptographically valid, never that the user row still existed — a deleted account's unexpired
  mobile JWT (30-day TTL) kept resolving to a real userId, which then hit a foreign-key error
  (raw 500) on the first route that tried to write with it. Fixed by adding one indexed
  existence check inside `resolveUserId` itself, so every route gets the fix for free.
- Verified via a 20-check script hitting the live dev server: headers present/CSP correctly
  absent in dev, health check, custom 404, rate-limit blocks the 6th attempt with `Retry-After`,
  export shape and redaction, deletion rejects the wrong password then succeeds and cascades, and
  a deleted user's token is cleanly rejected afterward (the bug above, confirmed fixed).

## Mobile app (`mobile/`)

A real Expo/React Native TypeScript app — not a WebView wrapper — sharing this same Next.js
backend and database. Covers Auth, an AI Assistant home screen, Jobs (feed + score breakdown +
"Prepare application"), Applications (status progression, resume/cover-letter/Q&A review and
approval), Networking (contact list, per-type outreach drafting, mark-as-sent), and Interview
Preparation (STAR questions, rehearsed toggle, mock-answer scoring).

```bash
cd mobile
npm install
npm run web      # Expo web target — see caveat below
# npm run ios / npm run android — require Xcode / an Android emulator, neither available here
```

- **Shared backend, not a shared session**: the web app authenticates via NextAuth's cookie
  session; the mobile app can't hold a browser cookie jar, so `lib/mobile/auth.ts` issues a
  30-day JWT (signed with the same `AUTH_SECRET`) on `/api/mobile/auth/{login,register}`, and
  every mobile-facing API route resolves the caller through `lib/auth/resolveUserId.ts`, which
  checks a `Bearer` token first and falls back to the cookie session — one function, so no route
  has two separate auth implementations to keep in sync.
- **CORS is dev-only and origin-restricted**: native iOS/Android has no CORS concept at all, but
  the Expo *web* target is a real browser making cross-origin requests to this Next.js origin.
  `middleware.ts` handles `/api/*` CORS (including OPTIONS preflight) separately from the
  existing NextAuth page-protection middleware, and only allows `http://localhost:*` origins — a
  hosted Expo web build would need its real origin added.
- **Native-testing limitation, disclosed rather than papered over**: this environment is Windows
  with no Xcode (Mac-only, can never run here) and no Android emulator installed. The app was
  verified end-to-end (sign-in, jobs, application prep and status changes, outreach drafting,
  interview-prep rehearsal and mock-answer scoring, sign-out) against the live backend through
  Expo's *web* target, which exercises the same React/TypeScript logic and API calls a native
  build would — but not native rendering, gestures, or platform chrome. Only a Mac (for iOS) or
  an installed Android SDK/emulator could close that last gap.
- The app icon/splash use Expo's scaffold-default artwork with the product's brand color
  (`#F4F1EA`) applied as the background — real icon art needs a designer asset, not something
  generated here.

## Milestone roadmap

| # | Milestone | Status |
|---|---|---|
| 1–10 | Foundation, Resume/Profile, Jobs, AI Matching, Resume Customization, Application Workspace, Networking & Outreach, Follow-Up Engine, Interview Preparation, Central AI Assistant | **Built** (this codebase) |
| 11 | Mobile (React Native/Expo) | **Built** (`mobile/`) — verified via Expo web target, native simulators unavailable in this environment |
| 12 | Billing (Stripe + entitlements) | **Built** (`lib/billing/`) — inert (Free-tier only) until real Stripe keys are added |
| 13 | Production hardening | **Built** — security headers, rate limiting, env validation, error boundaries, health check, data export/account deletion, structured logging |

All 13 milestones are built. The sidebar shows all 7 top-level nav items, every one of them a
real feature — nothing is a placeholder anymore.
