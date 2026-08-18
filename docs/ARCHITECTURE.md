# Architecture

This document describes the actual, current architecture of AI Career Agent — a Next.js 16 web application with a companion Expo/React Native mobile app, sharing one Postgres database and one Next.js backend. Everything below was traced through real code on the current `main` branch, not inferred from folder names.

## 1. Overall architecture

```
┌─────────────────┐        ┌──────────────────┐
│   Web browser    │        │  Expo mobile app  │
│ (Next.js pages)  │        │  (iOS/Android/    │
│ NextAuth session  │        │   Expo web)        │
│     cookie        │        │  Bearer JWT token  │
└────────┬─────────┘        └─────────┬─────────┘
         │  same origin, cookie          │  Authorization: Bearer <token>
         │                               │  (CORS-allowed in dev via proxy.ts)
         ▼                               ▼
┌──────────────────────────────────────────────────┐
│           Next.js 16 App Router (app/)            │
│  proxy.ts — route protection (web) + CORS (API)    │
│  app/api/**/route.ts — Route Handlers              │
│     resolveUserId() — unifies both auth paths      │
└───────────────────────┬────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│                  lib/ (business logic)             │
│  scoring · evidence · assistant · billing · ai ·    │
│  storage · mail · push · briefing · security · ...  │
└───────────────────────┬────────────────────────────┘
                         │  Prisma singleton (lib/prisma.ts)
                         ▼
                 ┌───────────────┐
                 │  PostgreSQL    │
                 └───────────────┘

  External services (all behind a "swap-point provider" —
  real when configured, honest fallback otherwise):
  Anthropic Claude · Stripe · AWS S3 (or compatible) ·
  Expo Push · Adzuna · (email: fallback only, no real provider wired)
```

Both clients — the Next.js web frontend and the Expo mobile app — talk to the **same** Next.js backend and the **same** Postgres database. There is no separate mobile backend or GraphQL layer; the mobile app is a REST client of the identical `app/api/` routes the web frontend uses, differing only in how it authenticates (see §6).

## 2. Frontend architecture (web)

- **Next.js 16, App Router** (not Pages Router) — confirmed by the `app/` directory structure with route groups: `app/(app)/` (every authenticated product page) and `app/(auth)/` (login/register/password-reset), plus `app/api/` (backend routes), `app/dev/` (development-only debug pages, hard-blocked in production), and `app/terms/`, `app/privacy/`.
- **Server components by default.** Roughly half of the `.tsx` files under `app/` and `components/` are explicitly marked `"use client"` — the rest are server components. A typical authenticated page's `layout.tsx` is a server component that calls `auth()` directly and redirects unauthenticated visitors before any client code runs; interactive pieces (forms, chat, kanban drag targets) are client components nested inside.
- **Styling**: Tailwind CSS (`tailwind.config.ts`), with a centralized design-token system in `theme.extend` — a warm off-white/ink color palette (`bg`, `card`, `border`, `ink.*`), a separate dark `sidebar.*` palette, and a semantic `accent.*` set (teal/link/success/warning/risk, each with paired `-bg`/`-border`/`-text` variants, largely defined in OKLCH). Custom `fontFamily` (serif/sans/mono, via CSS variables) and `borderRadius` tokens (`card`, `btn`, `pill`). A `/dev/design-tokens` debug page exists purely to visually inspect this palette.
- **State/data fetching**: no global state management library — pages fetch their own data client-side (`fetch()` to the app's own API routes) or server-side via direct Prisma/`auth()` calls in server components. There is no SWR/React Query/Redux in the dependency tree.

## 3. Frontend architecture (mobile)

- **Expo + React Native**, TypeScript, its own `package.json`/lockfile inside `mobile/`, typechecked as a separate CI job from the web app.
- **Navigation**: a tab navigator (`MainTabNavigator.tsx`) with six tabs — Home, Jobs, Applications, Networking, Interviews, Settings — and a separate auth stack (Login, Register only — no forgot/reset-password flow exists on mobile).
- **Data fetching**: `apiFetch()` wraps `fetch()` calls to the same Next.js backend, attaching the stored Bearer token. No offline cache/sync layer — every screen fetches fresh on mount.
- Mobile intentionally does not replicate every web feature — see `PRODUCT.md` for the full parity breakdown (resume upload, career profile editing, analytics, billing, and search-preferences editing are all web-only today).

## 4. Backend architecture

- **API route handler pattern**: every `app/api/**/route.ts` follows the same shape, seen consistently across the ~47 route files: resolve the caller's identity → validate the request body with Zod → apply rate limiting → apply any billing/entitlement gate → apply any AI-spend budget check → call into a `lib/` module for the actual business logic → persist via Prisma → return `NextResponse.json(...)`. Route handlers themselves are thin orchestrators; they do not contain scoring, extraction, or generation logic inline.
- **Prisma singleton** (`lib/prisma.ts`): the standard `globalThis`-cached `PrismaClient` pattern, so Next.js dev-mode hot reloads don't open a new connection pool on every file save.
- **Logic organization**: business logic lives almost entirely in `lib/`, split further into **pure functions** (no DB, no network — e.g. `lib/scoring/scoreJob.ts#computeMatchScore`, independently unit-tested) and **async DB-wrapper functions** that load data and call the pure function (e.g. `lib/billing/entitlements.ts` separates `resolvePlan`/`checkJobCap` (pure) from `getPlan`/`assertJobImportAllowed` (async, DB-backed) explicitly so the pure half is unit-testable without a database at all).

## 5. Data flow

A representative request (scoring a newly pasted job) flows as:

1. Client (web or mobile) `POST`s to `/api/jobs` with the raw posting text.
2. The route handler resolves the caller via `resolveUserId(request)`.
3. Zod validates the body; rate limiting and the Free-tier job cap (`assertJobImportAllowed`) are checked; the per-user AI-spend budget is checked.
4. `lib/jobs/extractJob.ts` calls the active AI provider (real Claude or the offline heuristic mock — see §9) to parse the posting into structured requirements.
5. `lib/scoring/scoreJob.ts#computeMatchScore` — a **pure function with no AI or DB involvement** — computes the actual match score, category breakdown, and any hard disqualifiers from the parsed requirements plus the user's stored Career Profile.
6. The route persists a `Job` row and a `MatchScore` row, auto-creates an `Application` row in `DISCOVERED` status, and logs an `AIInteraction` row (provider, token counts, estimated cost) for the AI call in step 4.
7. The response returns the created job and its score to the client.

This same **deterministic-computation-then-AI-only-explains** shape recurs throughout the codebase (resume matching, ATS scoring, the assistant's "why am I not hearing back" analysis, the daily-briefing narrative): a pure function decides the numbers/facts, and the AI provider — when configured — is used only to phrase an already-final result into prose, never to decide the result itself.

## 6. Authentication & authorization

Two parallel authentication mechanisms exist, unified through one function so every route only needs to call one thing:

- **Web**: NextAuth v5 (`auth.ts`/`auth.config.ts`), Credentials provider, JWT session strategy, session cookie. `auth.config.ts` is deliberately Prisma-free so `proxy.ts` can build a lightweight `NextAuth(authConfig)` instance for route protection without pulling the full auth module graph into every request.
- **Mobile**: a 30-day HS256 JWT (`lib/mobile/auth.ts`, using the `jose` library), signed with the **same** `AUTH_SECRET` as web sessions, issued by `/api/mobile/auth/{login,register}` and sent back as `Authorization: Bearer <token>` on every subsequent request.
- **Unification**: [`lib/auth/resolveUserId.ts`](../lib/auth/resolveUserId.ts) is the single function nearly every API route calls. It checks for a Bearer token first, falls back to the web session cookie, and then re-verifies that the resolved user id still exists in the database — a deliberate extra check that prevents a stale token/cookie for an already-deleted account from resolving to a dead foreign key elsewhere.
- **Authorization**: there is no role-based access control — the only differentiation is the Free/Pro subscription plan (see `PRODUCT.md` §User tiers). Every gated route checks entitlement server-side (never only in the UI), returning `402` with `{ upgradeRequired: true }`.
- **Route protection for pages** (not API routes) happens in `proxy.ts`, Next.js 16's replacement for the old `middleware.ts` (renamed; this file always runs on the Node.js runtime now, not the Edge runtime the old name implied). It redirects unauthenticated visitors away from protected page paths (`/assistant`, `/resumes`, `/profile`, `/jobs`, `/applications`, `/analytics`, `/settings`).
- **CORS**: `/api/*` requests get CORS headers from `proxy.ts` (including `OPTIONS` preflight handling), restricted to `http://localhost:*` origins — this exists specifically for the Expo *web* target, which runs as a real browser making cross-origin requests; native iOS/Android has no CORS concept at all. A hosted Expo web build would need its real origin added to this allowlist.

## 7. External services

Every optional external integration follows the identical **"swap-point provider" pattern**: one function (`getXProvider()` / `getXClient()` / `isXConfigured()`) is the *only* place in the codebase that checks the relevant environment variable, and the real SDK is only ever lazily required when that variable is present — every other call site goes through that one function rather than checking `process.env` itself.

| Service | Module | Status |
|---|---|---|
| **Anthropic Claude** | `lib/ai/` | Real when `ANTHROPIC_API_KEY` is set; otherwise a genuine offline heuristic engine (`providers/mock/`) — not a stub — handles resume/job extraction and scoring rationale deterministically. |
| **Stripe** | `lib/billing/stripeClient.ts` | Real when `STRIPE_SECRET_KEY` is set; the client throws if called without one (callers must check `isStripeConfigured()` first). Free-tier product works fully without it. |
| **AWS S3 / S3-compatible** | `lib/storage/` | Real (`s3.ts`) when `S3_BUCKET` is set — works against real AWS, Cloudflare R2, or any S3-compatible endpoint via `S3_ENDPOINT`. Falls back to `localDisk.ts` for zero-setup local dev — **not durable across redeploys in most hosting environments**, see `KNOWN-ISSUES.md`. |
| **Expo Push** | `lib/push/` | Real by default (`providers/expoPush.ts`) — unlike the other integrations, Expo's push service needs no paid account, so there's no reason to default to a stub. `EXPO_PUSH_DISABLED=true` is the explicit local-dev/test opt-out (falls back to a console/`PushLog` provider). |
| **Adzuna** (job import) | `lib/jobs/sources/adzuna.ts` | Real when both `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are set; the import route returns `{configured:false}` rather than erroring when they're not. |
| **Email** | `lib/mail/` | **Stub only — no real provider exists yet.** Every "sent" email is written to the `EmailLog` table and viewable at `/dev/outbox` (blocked outside development). This includes password-reset emails, so account recovery is currently non-functional for a real deployed user. See `KNOWN-ISSUES.md`. |

## 8. AI / LLM components

There is no single "AI layer" — every AI call is scoped to one narrow, specific task, routed through the provider abstraction in `lib/ai/`:

- **Resume/job extraction**: turning uploaded resume text or a pasted job posting into structured data.
- **Match scoring rationale**: the score itself is always computed deterministically (`lib/scoring/`); the AI provider is only asked to phrase already-final numbers into prose.
- **Resume customization**: `lib/resume/` deterministically selects and reorders which existing skills/bullets to surface for a given job; the AI provider is asked for exactly one rephrased summary sentence, and its output is citation-checked against the deterministic selection before being kept — nothing new is ever authored into the resume.
- **Application package generation**: cover letters and screening Q&A, grounded only in facts the deterministic layer has already assembled (`buildApplicationFacts`).
- **Networking outreach drafts**: same grounding pattern, applied to contact messages.
- **Interview prep**: STAR-format answers are entirely deterministic (not AI-generated at all — mechanically derived from resume data). The one real AI call in this feature is mock-interview response scoring, which grounds itself only in the question and the user's typed response.
- **Assistant chat**: a regex/keyword intent classifier (`lib/assistant/intentClassifier.ts`, not an LLM) routes a message to one of 8 scoped, DB-backed tool functions; the AI provider only phrases that tool's already-computed result into a reply, never free-generating a claim about the user's data.
- **Cost/usage tracking**: every AI call is logged to the `AIInteraction` table (provider, token counts, estimated cost), and `lib/ai/usageLimits.ts` enforces a configurable daily spend cap per user, checked before nearly every AI-invoking route proceeds.
- **Evidence/citation enforcement**: `lib/evidence/` deterministically validates every AI-touched claim against real source text (a substring/fuzzy match, not a second LLM call asked to self-certify) and assigns a confidence level that can only ever be downgraded on re-validation, never upgraded.

## 9. Important architectural decisions

- **Deterministic-computation-then-AI-only-explains**, applied consistently across every AI-touching feature (§8) — the explicit stated reason (per `lib/scoring/scoreJob.ts`'s own comment) is that the product's core promise is "the system calculates, the AI explains," not the other way around.
- **Swap-point provider pattern** for every optional external service (§7) — a deliberate way to keep the product fully functional and honestly degraded with zero third-party credentials configured, rather than presenting fake functionality.
- **404, never 403, on cross-tenant access.** Every route scoping a resource by `{ id, userId }` returns `404 Not Found` if the resource belongs to someone else, rather than `403 Forbidden` — this avoids confirming to an attacker that a resource with that ID exists at all. This is explicitly asserted by the tenant-isolation integration test suite.
- **Pro-gating is enforced server-side on every gated route**, never only hidden in the UI — the same `assertProFeature`/`assertJobImportAllowed` gate functions are called directly inside the route handlers.
- **`resolveUserId` re-checks the user still exists in the database** on every call, rather than trusting a cryptographically-valid but possibly-stale token/cookie — closing a real bug class where a deleted account's still-unexpired mobile JWT could otherwise resolve to a foreign key that no longer exists.
- **No background job scheduler for anything except the daily briefing.** "Due" states (follow-ups) are computed at read time (`dueDate <= now`), not by a cron sweep — the only actual scheduled job in the system is the hourly GitHub Actions workflow that triggers `/api/cron/daily-briefing`.
- **Enum-like DB fields are plain `String`, not native Postgres enums** — the single source of truth for valid values is the TypeScript unions in `lib/types/enums.ts`, checked at the application layer. See `DATABASE.md` for the full field-to-type mapping and the handful of fields where this mapping is currently incomplete.
- **No status-history table.** Only the *current* status of an application/follow-up/outreach message is stored — there is no audit trail of prior transitions. The Analytics page's funnel is explicitly labeled as a current-status snapshot, not a true historical cumulative funnel, because of this.
