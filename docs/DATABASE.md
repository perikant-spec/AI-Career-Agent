# Database

This document describes the actual database schema as defined in [`prisma/schema.prisma`](../prisma/schema.prisma) and its migration history, as of the current `main` branch. Every model, field, and relationship below was read directly from that file — nothing here is inferred from naming conventions alone.

## Technology

- **Database**: PostgreSQL (14+). The project ran on SQLite during initial prototyping but has been on Postgres since the `20260815124448_init_postgres` migration — there is no SQLite code path remaining.
- **ORM**: [Prisma](https://www.prisma.io/) (`@prisma/client` / `prisma` CLI, both pinned to `^6.19.3`). The Prisma client is a singleton exported from [`lib/prisma.ts`](../lib/prisma.ts) and imported everywhere the app touches the database — there is no separate data-access layer or repository pattern.
- **Connection**: a single `DATABASE_URL` connection string, tunable via query params (`connection_limit`, `pool_timeout`) documented in `.env.example`. A high-concurrency serverless deployment is expected to sit this behind PgBouncer or Prisma Accelerate rather than relying on Prisma's own pool alone (per the schema's own header comment).
- **Config split**: `prisma.config.ts` (CLI-facing — schema path, migrations path, `engine: "classic"`, datasource URL) is separate from the `datasource`/`generator` blocks inside `schema.prisma` itself. The `generator client` block sets `binaryTargets = ["native", "debian-openssl-3.0.x"]` so the Prisma query engine binary built in CI/Docker actually matches the `node:20-slim` container runtime the `Dockerfile` ships.

## Modeling convention: enum-like fields are `String`, not Prisma `enum`

Every field that represents a closed set of values (status, category, tier, type, etc.) is modeled as a plain `String` column, not a native Prisma/Postgres `enum`. This is a deliberate, documented choice (stated at the top of `schema.prisma`): the single source of truth for these value sets is the TypeScript unions in [`lib/types/enums.ts`](../lib/types/enums.ts), checked at the application layer via TypeScript/Zod — not enforced by the database. This means the database itself will accept any string in these columns; validity is only guaranteed by application code (API route Zod schemas) always going through the shared enum constants.

| DB field | TS type | Exported const array (`lib/types/enums.ts`) |
|---|---|---|
| `CareerProfileEntry.section` | `ProfileSection` | `PROFILE_SECTIONS` |
| `CareerProfileEntry.confidence` | `ConfidenceLevel` | `CONFIDENCE_LEVELS` (+ `CONFIDENCE_RANK` — an ordinal used to enforce "a value can only be downgraded, never upgraded") |
| `ResumeDocument.extractionStatus` | `ResumeExtractionStatus` | `RESUME_EXTRACTION_STATUSES` |
| `Job.source` | `JobSource` | `JOB_SOURCES` |
| `MatchScore.recommendationTier` | `RecommendationTier` | `RECOMMENDATION_TIERS` (+ `RECOMMENDATION_LABELS`) |
| `MatchScore.categoryScores` (JSON keys) | `MatchCategory` | `MATCH_CATEGORIES` (+ `MATCH_CATEGORY_LABELS`) |
| `Application.status` | `ApplicationStatus` | `APPLICATION_STATUSES` (+ `APPLICATION_STATUS_LABELS`, `APPLICATION_STATUS_ORDER`, `LIVE_APPLICATION_STATUSES`) |
| `FollowUp.status` | `FollowUpStatus` | `FOLLOW_UP_STATUSES` |
| `InterviewQuestion.category` | `InterviewQuestionCategory` | `INTERVIEW_QUESTION_CATEGORIES` |
| `Contact.contactType` | `ContactType` | `CONTACT_TYPES` |
| `Contact.source` | `ContactSource` | `CONTACT_SOURCES` |
| `OutreachMessage.messageType` | `OutreachMessageType` | `OUTREACH_MESSAGE_TYPES` |
| `OutreachMessage.status` | `OutreachMessageStatus` | `OUTREACH_MESSAGE_STATUSES` |
| `AIInteraction.provider` | deliberately an open string (not a closed union) — new providers can be added without a type change |

A few fields are documented only via an inline schema comment, with **no corresponding exported TypeScript union** found in `lib/types/enums.ts`: `Subscription.plan` (`FREE \| PRO`), `Subscription.status` (`ACTIVE \| TRIALING \| PAST_DUE \| CANCELED \| INCOMPLETE`), `PushToken.platform` (`IOS \| ANDROID \| WEB`), and `AIInteraction.status` (`SUCCESS \| ERROR`). This is a documentation/consistency gap noted in `KNOWN-ISSUES.md`, not a functional bug — these values are still validated at the specific call sites that set them, just not centralized.

## Entity groups

The 21 models fall into six functional groups. `onDelete: Cascade` is used consistently for every user-owned relation, so deleting a `User` row cleans up their entire footprint in one operation (this is what the self-service account-deletion feature relies on).

### 1. User & Auth

**`User`** — the root entity. `email` (unique), `passwordHash` (bcrypt, never the raw password), `name`, password-reset fields (`passwordResetTokenHash`, `passwordResetTokenExpiresAt` — single-use, cleared on success), and legal-consent fields (`termsAcceptedAt`/`termsVersion`, `privacyAcceptedAt`/`privacyVersion` — the version captured is the one accepted *at that time*, not necessarily the current version, so a later document update can be detected by comparison). Holds reverse relations to every other user-owned model.

**`UserPreferences`** (1:1 with `User`) — job-search preferences (`targetTitles`, `targetLocations`, `salaryFloor`, `workAuthorization` as free text), `followUpDays` (fixed integer offset, default 7 — not adaptive), `aiTrainingOptIn` (opt-in, defaults `false`), and `timezone` (IANA zone name, defaults `"UTC"` — drives interview-time display and the daily-briefing cron's per-user "is it their morning" check).

### 2. Resume & Career Profile

**`ResumeDocument`** — an uploaded file's metadata (`fileName`, `storageKey`, `mimeType`, `fileSizeBytes`) plus extracted `rawText` and `extractionStatus` (`PENDING \| SUCCESS \| PARTIAL \| FAILED \| UNSUPPORTED_FORMAT`). One `isMaster` flag per user's active resume.

**`CareerProfileEntry`** — an individual structured fact extracted from a resume (a skill, a job, a degree, etc.): `section`, `label`/`value`, optional `structuredData` (JSON, shape depends on section), and a `confidence` level (`VERIFIED \| SUPPORTED_INFERENCE \| NOT_VERIFIED \| MISSING`). Carries `sourceSpanStart/End/Text` — the exact substring of the source resume it was extracted from, snapshotted so it survives later resume edits — and `basisText` for inferred entries. `userConfirmed`/`userEdited` track whether the user has reviewed/changed it.

### 3. Jobs & Matching

**`Job`** — a job posting, either `MANUAL_PASTE`d or imported from `ADZUNA`. Stores `rawText` plus parsed fields (`title`, `company`, `locationText`, `parsedRequirements` as JSON).

**`MatchScore`** (unique per `userId`+`jobId`) — the scoring result for one job against one user's profile: `overallScore`, per-category breakdown (`categoryScores` JSON), `strengths`/`gaps`/`risks` (JSON string arrays), `disqualifiers` (JSON array of `{code, reason}`), and `recommendationTier` (`APPLY_STRONG \| APPLY \| APPLY_IF_INTERESTED \| LOW_PRIORITY \| DONT_APPLY`). `profileVersionHash` detects when the underlying profile has changed enough to warrant a recompute.

**`ResumeVersion`** (unique per `userId`+`jobId`) — a job-tailored resume: `content` (JSON snapshot of the tailored structure — the customizer only ever reorders/rephrases entries that already exist in the master profile, never introduces new ones), `changeLog`, and before/after ATS scores.

### 4. Applications & Tracking

**`Application`** (unique per `userId`+`jobId`) — the tracker row for a job the user is pursuing. `status` is one of 13 values (`DISCOVERED → SHORTLISTED → PREPARING → READY_TO_APPLY → APPLIED → RECRUITER_CONTACT → SCREENING → INTERVIEW → FINAL_INTERVIEW → OFFER → ACCEPTED`, plus `REJECTED`/`WITHDRAWN`), always set by explicit user action. Holds generated `coverLetterContent`/`qaAnswers` (JSON) and three independent approval flags (`resumeApproved`, `coverLetterApproved`, `qaApproved`). `discoveredAt` is set on creation; `appliedAt` only when status first reaches `APPLIED`.

**`FollowUp`** (1:many from `Application`) — a scheduled reminder: `dueDate`, `status` (`PENDING \| COMPLETED \| DISMISSED`), and an optional AI-drafted `draftedMessage`. "Due" is computed at read time (`dueDate <= now`), not by any background job.

### 5. Interviews

**`InterviewPrep`** (1:1 with `Application`) — built once an application reaches `INTERVIEW`/`FINAL_INTERVIEW`. `companyResearch` (JSON) is deterministically extracted from the job posting's own text, never fabricated. `scheduledAt` (`DateTime? @db.Timestamptz(6)`) is the schema's one deliberate deviation from its otherwise-plain-`DateTime` convention — stored as a timezone-aware absolute instant because getting this wrong would misfire a push notification by hours; it is nullable because the daily briefing must never invent a time when none has been set.

**`InterviewQuestion`** (1:many from `InterviewPrep`) — one generated question: `category` (`BEHAVIORAL \| TECHNICAL \| ROLE_SPECIFIC \| LEADERSHIP \| COMPANY_FIT`), the STAR breakdown fields (`starSituation/Task/Action/Result`, each independently nullable — deterministically derived from resume data, not AI-generated), and a `rehearsed` flag.

**`MockInterviewAttempt`** (1:many from `InterviewQuestion`) — a scored practice answer: `responseText` plus four 0–100 sub-scores (`scoreRelevance`, `scoreClarity`, `scoreStructure`, `scoreCompleteness`) and `feedback` text, scored only against the response's own content.

### 6. Networking

**`Contact`** — a user-supplied networking contact tied to a `Job`: `name`, `role`, `contactType` (`HIRING_MANAGER \| RECRUITER \| TEAM_LEAD \| EXISTING_CONNECTION \| REFERRAL \| OTHER`), `source` (currently only `USER_SUPPLIED` is ever produced — `PROVIDER_VERIFIED` is a defined-but-unimplemented future value), a user-authored `relationshipNote`, and an optional user-set `warmth` (0–100 — never computed from any enrichment signal).

**`OutreachMessage`** (unique per `contactId`+`messageType`) — a drafted message for a contact: `messageType` (`CONNECTION_REQUEST \| AFTER_CONNECT \| RECRUITER_MESSAGE \| HIRING_MANAGER_MESSAGE \| REFERRAL_ASK \| FOLLOW_UP`), `content`, and `status` (`DRAFT \| SENT` — `SENT` is only ever set by an explicit user "mark as sent" action; no code path in this application actually transmits a message anywhere).

### 7. Billing

**`Subscription`** (1:1 with `User`) — `plan` (`FREE \| PRO`), `status` (`ACTIVE \| TRIALING \| PAST_DUE \| CANCELED \| INCOMPLETE`), and Stripe identifiers (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `currentPeriodEnd`, `cancelAtPeriodEnd`). Only the Stripe webhook handler ever writes the Stripe-derived fields — no user-facing route sets `plan`/`status` directly, so this table cannot drift from what Stripe's own records say.

### 8. Notifications & Daily Briefing

**`PushToken`** — an Expo push token registered from a device: `token` (unique), `platform` (`IOS \| ANDROID \| WEB` — `WEB` is stored but never targeted by the sender, since there is no real web push capability). Many-per-user, since a user can have multiple devices or a reinstall can leave a stale token behind.

**`DailyBriefingLog`** (unique per `userId`+`localDate`) — an idempotency/dedup record for the hourly daily-briefing cron: `localDate` is stored as a string (e.g. `"2026-08-17"`), not a `DateTime`, specifically so uniqueness means "this local calendar day" regardless of which UTC instant it maps to. Also serves as the "how many jobs are new since the last briefing" cursor.

### 9. Operational / logging tables (not user-facing domain data)

These four tables exist to support internal mechanisms, not to represent something a user directly creates or views:

- **`AIInteraction`** — an audit/cost log of every AI-provider call (`toolName`, `provider`, `providerVersion`, `status`, token counts, `estimatedCostUsd`). Powers the per-user daily AI spend cap (`lib/ai/usageLimits.ts`).
- **`EmailLog`** — every message the console `MailProvider` "sent" (`to`, `subject`, `text`). This is the *actual* output of email sending today, since no real provider is wired in — see `ARCHITECTURE.md`. Viewable at `/dev/outbox`, which is hard-blocked outside development.
- **`PushLog`** — the equivalent log for the console/test `PushProvider`, used only when `EXPO_PUSH_DISABLED=true`.

## Relationships

Nearly every model relates back to `User` with `onDelete: Cascade`, and most application-domain models chain further off `Job` or `Application`. The core dependency shape:

```
User ─┬─ ResumeDocument ─── CareerProfileEntry (via sourceDocumentId, onDelete: SetNull)
      ├─ Job ─┬─ MatchScore
      │       ├─ ResumeVersion
      │       ├─ Application ─┬─ FollowUp
      │       │               └─ InterviewPrep ─┬─ InterviewQuestion ─── MockInterviewAttempt
      │       │                                 └─ (scheduledAt)
      │       └─ Contact ─── OutreachMessage
      ├─ UserPreferences (1:1)
      ├─ Subscription (1:1)
      ├─ PushToken (many)
      ├─ DailyBriefingLog (many)
      └─ AIInteraction (many, audit log)
```

`CareerProfileEntry` is the one model that does not hang off `Job`/`Application` — it belongs directly to `User` (via the resume it was extracted from), since a profile is job-independent.

## Indexes and constraints

Besides primary keys (`@id @default(cuid())` on every model) and the column-level `@unique` on `User.email`:

| Model | Constraint |
|---|---|
| `ResumeDocument` | `@@index([userId])` |
| `CareerProfileEntry` | `@@index([userId, section])`, `@@index([sourceDocumentId])` |
| `Job` | `@@index([userId])` |
| `MatchScore` | `@@unique([userId, jobId])`, `@@index([jobId])` |
| `ResumeVersion` | `@@unique([userId, jobId])`, `@@index([jobId])` |
| `Application` | `@@unique([userId, jobId])`, `@@index([userId, status])`, `@@index([jobId])` |
| `FollowUp` | `@@index([userId, status, dueDate])`, `@@index([applicationId])` |
| `InterviewPrep` | `@@unique` on `applicationId` (1:1), `@@index([userId])` |
| `InterviewQuestion` | `@@index([interviewPrepId])` |
| `MockInterviewAttempt` | `@@index([userId, interviewQuestionId])`, `@@index([interviewQuestionId])` |
| `Contact` | `@@index([userId, jobId])`, `@@index([jobId])` |
| `OutreachMessage` | `@@unique([contactId, messageType])` — at most one message of a given type per contact — `@@index([userId, contactId])` |
| `UserPreferences` | `@@unique` on `userId` (1:1) |
| `Subscription` | `@@unique` on `userId` (1:1) |
| `PushToken` | `@@unique` on `token`, `@@index([userId])` |
| `DailyBriefingLog` | `@@unique([userId, localDate])`, `@@index([userId])` |
| `AIInteraction` | `@@index([userId, createdAt])` |
| `EmailLog` / `PushLog` | `@@index([to, createdAt])` |

The `[userId, status]`/`[userId, status, dueDate]`/`[userId, createdAt]` compound indexes consistently support the app's most common query shape: "this user's rows, filtered/sorted by a status or time field."

## Data lifecycle

- **Creation**: every domain row is created through an authenticated API route acting on behalf of `resolveUserId(request)` — there is no direct client-side database access.
- **Updates**: most models track `createdAt`/`updatedAt` (`@updatedAt` auto-managed by Prisma). Status transitions (`Application.status`, `FollowUp.status`, `OutreachMessage.status`) are always explicit, user-driven writes — no background job silently advances a status.
- **Deletion**: deleting a `User` row cascades through every relation above (`onDelete: Cascade` throughout), which is exactly what the self-service account-deletion endpoint (`DELETE /api/account`) relies on — one `prisma.user.delete()` call, plus a separate `storage.deleteAll(userId)` call for the physical resume files that live outside the database.
- **No soft deletes**: nothing in the schema has a `deletedAt`/`isDeleted` field — deletion (of a user, a job, a contact, etc.) is always a real row removal, cascading as described above.
- **No status-history table**: the schema stores only the *current* status of an `Application`/`FollowUp`/`OutreachMessage` — there is no separate audit table logging prior transitions. `lib/analytics/` explicitly labels its funnel numbers as current-status snapshots rather than a true historical cumulative funnel, because of this.

## Migrations

Migrations live under `prisma/migrations/`, applied with `prisma migrate dev` (local) or `prisma migrate deploy` (staging/production — see `docs/DEPLOYMENT.md` for why this is a manual release step, not something the running container does automatically). Four migrations exist, in order:

1. **`20260815124448_init_postgres`** — the baseline Postgres schema: creates the 18 tables that existed at that point (everything above except `PushToken`, `DailyBriefingLog`, `PushLog`, and the privacy/timezone/scheduling columns added later), with all primary keys, unique/compound indexes, and foreign keys.
2. **`20260815132151_ai_usage_tracking`** — adds `estimatedCostUsd`, `inputTokens`, `outputTokens` (all nullable) to `AIInteraction`.
3. **`20260815141353_privacy_foundation`** — adds `privacyAcceptedAt`/`privacyVersion`/`termsAcceptedAt`/`termsVersion` to `User`, and `aiTrainingOptIn` (default `false`) to `UserPreferences`.
4. **`20260817021502_daily_briefing`** — adds `scheduledAt` to `InterviewPrep` and `timezone` to `UserPreferences`; creates `PushToken`, `DailyBriefingLog`, and `PushLog`.

All four are purely additive (new columns/tables) — none drop or rename an existing column, so there has been no destructive migration in this project's history to date.
