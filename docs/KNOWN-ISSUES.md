# Known Issues

A verified list of incomplete functionality, technical debt, and potential concerns in the current codebase — each item below was confirmed by reading the actual source (file/line citations included), not inferred from naming or assumed. Items already covered as product-level limitations in [`PRODUCT.md`](PRODUCT.md#current-limitations) are cross-referenced rather than duplicated in full; this document adds the technical detail and source citations behind them, plus items that are purely internal (not user-facing) findings.

## How to read this document

Each item is tagged with its practical impact:

- **User-facing** — a real person doing normal things will notice this.
- **Internal** — visible in code/ops, not something an end user would hit directly.
- **Security-relevant** — worth attention before a wider release, even if not an active exploit.

Nothing here is invented or speculative; every claim cites the file it was verified against.

## Security-relevant

### 1. API auth coverage is inconsistent between web-only and dual (web + mobile) routes
**Impact:** User-facing (mobile) / Internal (API consistency)

Most API routes resolve the caller via [`lib/auth/resolveUserId.ts`](../lib/auth/resolveUserId.ts), which accepts either a mobile Bearer token or a web session cookie. A specific set of routes only accept a web session (`getServerSession`/`auth()` directly) and will reject a valid mobile Bearer token with `401`:

- `app/api/resumes/route.ts`, `app/api/resumes/[id]/route.ts`, `app/api/resumes/[id]/set-master/route.ts`
- `app/api/profile/**`
- `app/api/preferences/route.ts`
- `app/api/jobs/[id]/rescore/route.ts`
- `app/api/jobs/[id]/resume-version/route.ts`
- `app/api/jobs/[id]/contacts/route.ts`
- `app/api/follow-ups/[id]/route.ts` and its `draft` sub-route
- `app/api/job-sources/route.ts`

This lines up exactly with the feature gaps documented in the mobile app itself (resume upload, profile editing, preferences editing, and job import are all web-only per `USER-GUIDE.md`) — so in practice no mobile screen currently calls these routes with a Bearer token. It is nonetheless a real inconsistency in the API surface: a route that silently behaves differently depending on auth mechanism is a common source of bugs if mobile feature parity is ever extended to these areas. Not an active vulnerability (cross-tenant access is not affected — see item 4), but worth normalizing before building the mobile screens that would need these routes.

### 2. Rate limiter is single-instance, in-memory — not correct in a multi-instance deployment
**Impact:** Security-relevant, Internal

`lib/security/rateLimit.ts` stores counters in a plain in-process `Map` (`const buckets = new Map<string, Bucket>()`, line 13), with a code comment explicitly acknowledging this is "a single-instance deployment" pattern (line 4). Login (`app/api/auth/[...nextauth]/route.ts`), registration, password reset, and mobile auth are all correctly rate-limited *today*, but only per server process. If the app is ever deployed behind multiple instances or as serverless functions (each with its own memory), an attacker can multiply their effective rate limit by the number of instances/invocations, defeating the protection. This is a known, accepted MVP limitation, not an oversight — but it should be replaced with a shared store (Redis/Upstash) before a production deployment that scales horizontally. Already listed as a future opportunity in `PRODUCT.md`; included here with its source citation for the engineering record.

### 3. `npm audit` reports 3 high-severity findings in a transitive Prisma CLI dependency
**Impact:** Internal (build/dev tooling), not runtime

`npm audit --omit=dev` (re-verified twice against a clean install) reports 3 high-severity advisories in `deepmerge-ts`, pulled in via `@prisma/config`, which is a dependency of the `prisma` CLI package itself — "DeepmergeTS has stack exhaustion when merging recursive object graphs." This is CLI/tooling-only (used by `prisma generate`/`migrate`, not by the running application), so it does not affect the deployed app's runtime attack surface. The available fix (`npm audit fix --force`) would downgrade `prisma` to `6.12.0`, a breaking change — not applied. Worth monitoring for a non-breaking upstream fix rather than forcing the downgrade.

## Incomplete or stub-only functionality

See `PRODUCT.md`'s [Current Limitations](PRODUCT.md#current-limitations) for the full user-facing list (no real email delivery, no email verification, empty legal page content, non-persistent local file storage by default, no hosting deployed yet, no error monitoring, no feedback channel, mobile feature gaps, mobile never built for a device). Technical detail behind a few of those:

### 4. `RESEND_API_KEY` is documented as an environment variable but no code path reads it
**Impact:** Internal

`.env.example`, `.env.staging.example`, and `.env.production.example` all list `# RESEND_API_KEY=""` as a commented-out option, and `lib/mail/index.ts` line 6 has a comment describing it as a future branch ("...add one later (e.g. `if (process.env.RESEND_API_KEY) return resendProvider;`)"). No such branch currently exists anywhere in the codebase — setting this variable today has zero effect. This is intentional scaffolding for the "future opportunity" already flagged in `PRODUCT.md`, not a bug, but it's worth knowing so nobody spends time setting the variable in an environment expecting it to do something.

### 5. Mobile app has no store-submission artifacts
**Impact:** User-facing (there is no shippable mobile build)

No `eas.json`, no configured bundle identifiers, no app-store listing content, and no evidence of a build ever run against a physical device or simulator beyond the Expo web target — confirmed by absence in `mobile/` and by the verification notes from the milestone that built the mobile app. The mobile app functions correctly in the Expo web preview but has never been exercised as an actual iOS/Android build.

## Technical debt / internal consistency

### 6. ~~Stale comment in `lib/prisma.ts` still references SQLite~~ — Fixed
**Impact:** Internal, cosmetic — no functional effect

`lib/prisma.ts` line 3's comment referenced "exhausting SQLite connections," left over from before the Postgres migration. Fixed: the comment now reads "Postgres connection pool," matching the database actually in use (see `docs/DATABASE.md`). No functional change — the singleton pattern itself was always correct and database-agnostic.

### 7. Five DB fields are modeled as plain `String` with no corresponding exported TypeScript union
**Impact:** Internal — type-safety gap

Most enum-like fields in `prisma/schema.prisma` have a matching exported union type in `lib/types/enums.ts` (documented in full in `docs/DATABASE.md`). Five do not — their only documentation is an inline schema comment, so a typo'd string value would type-check successfully at every call site:

| Field | Schema location | Comment |
|---|---|---|
| `Subscription.plan` | `prisma/schema.prisma:456` | `FREE \| PRO` |
| `Subscription.status` | `prisma/schema.prisma:457` | `ACTIVE \| TRIALING \| PAST_DUE \| CANCELED \| INCOMPLETE` |
| `PushToken.platform` | `prisma/schema.prisma:493` | `IOS \| ANDROID \| WEB` |
| `AIInteraction.status` | `prisma/schema.prisma:430` | `SUCCESS \| ERROR` |
| `Job.extractionConfidence` | `prisma/schema.prisma:127` | free-text confidence label |

None of these have caused an observed bug, but they're a latent risk the other, unionized fields don't share.

### 8. ~~Interview-prep "upgrade required" signal is inconsistent between `GET` and `PATCH`~~ — Fixed
**Impact:** Internal — API consistency, minor client-handling risk

In `app/api/applications/[id]/interview-prep/route.ts`, the same entitlement gate used to produce two different response shapes for a Free-plan user: `GET` returned `200 OK` with `upgradeRequired: true` in the body, while `PATCH` returned `402 Payment Required`. Fixed: `PATCH` now also returns `200` with `{ error, upgradeRequired: true }`, matching `GET`.

This direction (normalizing `PATCH` to `GET`'s shape, rather than the reverse) was deliberate rather than following this app's usual `402`-for-Pro-gates convention: the schedule picker this `PATCH` serves is only ever rendered client-side after `GET` has already reported `upgradeRequired: false`, and mobile's `apiFetch` (`mobile/src/api/client.ts:42-44`) discards a non-ok response's JSON body — so changing `GET` to `402` instead would have silently broken the mobile upgrade prompt (which reads `data.upgradeRequired` from a resolved response, not from a caught error) without a separate client-side fix. See `docs/API.md`'s entry for this route for the full rationale.

### 9. No status-change history is recorded anywhere in the schema
**Impact:** User-facing (Analytics) / Internal (data model)

`Application.status` (and every other pipeline-stage-like field) is overwritten in place with no history table behind it. This is already noted as a product limitation in `PRODUCT.md` (Analytics can only show a current-status snapshot, never a true historical funnel); the technical root cause is that no migration in `prisma/migrations/` ever introduced a status-history/audit table. Adding one is a schema change, not a small patch — worth scoping deliberately rather than bolting on.

## Performance

### 10. Daily-briefing cron loads every user with a push token on every hourly tick, unpaginated
**Impact:** Internal — will not scale past a small user base without changes

`app/api/cron/daily-briefing/route.ts` line 35 runs `prisma.user.findMany({ where: { pushTokens: { some: {} } }, ... })` with no `take`/pagination, then loops over the full result set sequentially, doing a DB read (`dailyBriefingLog.findUnique`) and a full `computeBriefing()` call per user before deciding whether they're actually in their local morning window. The code's own comment (lines 27–30) explicitly acknowledges this as a scale trade-off: "only a handful of users will ever be eligible on a given tick and computing the facts for everyone-with-a-token is cheap at this app's scale." That's an accurate assessment for the app's current size, but it's an unbounded, linear-scan pattern that would need batching/pagination (or a server-side "who's in their morning window right now" query) before a large user base.

### 11. No retention or cleanup policy on operational log tables
**Impact:** Internal — unbounded storage growth over time

`EmailLog`, `PushLog`, `AIInteraction`, and `DailyBriefingLog` all accumulate rows indefinitely with no TTL, archival job, or delete-old-rows migration anywhere in the codebase. Fine at current scale and useful for debugging/audit today; worth a retention policy before long-term production use.

## Testing / CI observations

### 12. A single non-reproducible failure was observed in `tests/unit/resumeExtraction.test.ts` — investigated, not a confirmed bug
**Impact:** None currently — documented for the record, not as an open defect

During an earlier audit pass, this test failed reproducibly (2/2 runs) in an isolated `git worktree` checkout of `main` after a fresh `npm ci`. On investigating this for accuracy before writing it up, the same test was re-run in the primary working directory: **7/7 consecutive passes**, including after performing a clean `npm ci` there too (confirmed `package-lock.json` had zero uncommitted drift via `git status`). GitHub Actions' own CI run against `main`'s actual HEAD commit — a genuinely fresh container, the most authoritative signal available — also shows the `Unit tests` job completing with `success`.

Given a deterministic, pure-function, non-DB, non-network test passing consistently both in CI and in repeated local runs (including post-clean-install), the single worktree failure is most plausibly a local environment artifact — this project lives under a OneDrive-synced folder on Windows, and OneDrive's background file sync is a known source of transient file-lock/timing flakiness during heavy I/O operations like a fresh `npm ci`. This is **not being reported as a confirmed bug**, but is recorded here rather than silently discarded, since the original failure was real and reproducible at the time it was observed, and the discrepancy itself is worth knowing about if it recurs.

## Summary table

| # | Issue | Category | User-facing? |
|---|---|---|---|
| 1 | Web-only auth on ~9 routes | Security-relevant | Only if mobile parity is extended |
| 2 | Single-instance in-memory rate limiter | Security-relevant | No (until multi-instance deploy) |
| 3 | `deepmerge-ts` high-severity advisories (Prisma CLI, dev-only) | Security-relevant | No |
| 4 | `RESEND_API_KEY` is a dead env var | Technical debt | No |
| 5 | Mobile app never built for a device / no store artifacts | Incomplete functionality | Yes |
| 6 | ~~Stale "SQLite" comment in `lib/prisma.ts`~~ | Technical debt | **Fixed** |
| 7 | 5 DB fields with no exported TS union | Technical debt | No |
| 8 | ~~Interview-prep `GET` vs `PATCH` upgrade-signal inconsistency~~ | Technical debt | **Fixed** |
| 9 | No status-change history table | Technical debt / product limitation | Yes (Analytics) |
| 10 | Unbounded per-tick user scan in briefing cron | Performance | No (until scale) |
| 11 | No retention policy on log tables | Performance / ops | No |
| 12 | Non-reproducible unit test failure (investigated, not confirmed) | Testing observation | No |
