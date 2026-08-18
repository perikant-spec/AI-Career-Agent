# API Reference

Every route below was read directly from `app/api/**/route.ts` on the current `main` branch — this list contains no endpoints that don't exist in code, and every documented request/response shape was confirmed against the actual handler.

## Conventions used throughout this document

- **Auth** column values:
  - **Dual** — resolved via `resolveUserId(request)` ([`lib/auth/resolveUserId.ts`](../lib/auth/resolveUserId.ts)): accepts either a web session cookie (NextAuth) or a mobile `Authorization: Bearer <token>` header. Usable from both the web app and the mobile app.
  - **Web only** — resolved via `auth()` directly (NextAuth session cookie). **Not reachable from the mobile app.** See [Known Issues](KNOWN-ISSUES.md) for the full list of web-only routes and why this matters.
  - **None** — no session required (e.g. registration, health check).
  - **Special** — a bespoke mechanism (Stripe webhook signature, cron shared secret) — described inline.
- **Standard error shape**: almost every error response is `{ "error": "<message>" }` with an appropriate status code. Deviations are called out per-route.
- **Standard entitlement-block shape**: routes gated behind a Pro feature return **402** with `{ "error": "<reason>", "upgradeRequired": true }`.
- Every route also inherits a general backstop rate limit from `proxy.ts` (300 requests / 5 minutes per IP on all of `/api/*`), on top of any per-route limit listed below.

---

## Auth

### `POST /api/auth/register`
Create a new account.
- **Auth**: None
- **Rate limit**: 5/hour per IP
- **Body**: `{ email, password, name? }`
- **Response 201**: `{ user: { id, email, name } }`
- **Errors**: `400` invalid input, `409` email already registered, `429` rate limited

### `POST /api/auth/forgot-password`
Request a password-reset email.
- **Auth**: None
- **Rate limit**: 5/hour per IP
- **Body**: `{ email }`
- **Response 200**: `{ message }` — **identical wording whether or not the account exists**, to prevent email enumeration
- **Errors**: `400` invalid input, `429` rate limited

### `POST /api/auth/reset-password`
Complete a password reset using the emailed token.
- **Auth**: None
- **Rate limit**: 10/hour per IP
- **Body**: `{ email, token, password }`
- **Response 200**: `{ success: true }`
- **Errors**: `400` invalid input or invalid/expired token, `429` rate limited

### `GET/POST /api/auth/[...nextauth]`
NextAuth.js catch-all — handles session cookie issuance, CSRF token, credentials callback, sign-out. Only the `/callback/credentials` POST path is rate-limited (15/15min per IP); all other NextAuth-internal routes pass through unmodified.

---

## Mobile Auth

Mobile clients use a separate token-based flow rather than a cookie session, since a native app has no cookie jar.

### `POST /api/mobile/auth/login`
- **Auth**: None
- **Rate limit**: 10 attempts/15min, keyed by IP + email
- **Body**: `{ email, password }`
- **Response 200**: `{ token, user: { id, email, name } }` — `token` is a 30-day JWT signed with the same `AUTH_SECRET` as web sessions
- **Errors**: `400` invalid body, `401` bad credentials, `429` rate limited

### `POST /api/mobile/auth/register`
- **Auth**: None
- **Rate limit**: 5/hour per IP
- **Body**: `{ email, password, name? }`
- **Response 201**: `{ token, user }`
- **Errors**: `400`, `409` email exists, `429`

### `GET /api/mobile/auth/me`
Restore the current user after app restart, given a stored token.
- **Auth**: Dual
- **Response 200**: `{ user: { id, email, name } }`
- **Errors**: `401` if the token is invalid or the user no longer exists

---

## Jobs

### `GET /api/jobs`
List the current user's tracked jobs.
- **Auth**: Dual
- **Response 200**: `{ jobs: [{ id, title, company, locationText, source, createdAt, score, applicationStatus }] }`

### `POST /api/jobs`
Import a job by pasting its posting text (no URL scraping — the raw text is required).
- **Auth**: Dual
- **Rate limit**: per `RATE_LIMITS.jobImport` (user + global)
- **Gates**: `assertJobImportAllowed` (Free tier capped at 5 tracked jobs) → `402`; AI budget check → `429`
- **Body**: `{ rawText (min 10 chars), sourceRef? }`
- **Response 200**: `{ job: { id, title, company }, matchScore }` — also auto-creates an `Application` in `DISCOVERED` status and scores the job immediately
- **Errors**: `400`, `401`, `402`, `429`, `500` on extraction failure

### `GET /api/jobs/[id]`
- **Auth**: Dual
- **Response 200**: `{ job: {...full detail incl. rawText, parsedRequirements}, matchScore | null }` — silently re-scores in the background if the user's profile changed since the last score (skipped, not erred, if AI budget is exhausted)
- **Errors**: `401`, `404`

### `DELETE /api/jobs/[id]`
- **Auth**: Dual
- **Response 200**: `{ success: true }`
- **Errors**: `401`, `404`

### `POST /api/jobs/[id]/apply`
Idempotent "prepare an application for this job" — generates whatever pieces are missing.
- **Auth**: Dual
- **Gate**: `assertProFeature("APPLICATION_PACKAGE")` → `402`
- **Rate limit**: `RATE_LIMITS.applicationGeneration`
- **Response 200**: `{ applicationId }`
- **Errors**: `401`, `402`, `404`, `429`

### `POST /api/jobs/[id]/rescore`
- **Auth**: Web only
- **Rate limit**: `RATE_LIMITS.jobRescore`
- **Response 200**: `{ matchScore }`
- **Errors**: `401`, `404`, `429`

### `GET /api/jobs/[id]/resume-version`
- **Auth**: Web only
- **Response 200**: `{ resumeVersion | null }`
- **Errors**: `401`, `404`

### `POST /api/jobs/[id]/resume-version`
Generate (or regenerate) a job-tailored resume.
- **Auth**: Web only
- **Rate limit**: `RATE_LIMITS.resumeCustomization`
- **Response 200**: `{ resumeVersion: { content, changeLog, atsScoreBefore, atsScoreAfter } }`
- **Errors**: `401`, `404`, `429`

### `GET /api/jobs/[id]/contacts`
- **Auth**: Web only
- **Response 200**: `{ contacts: [...] }`, ordered by warmth descending

### `POST /api/jobs/[id]/contacts`
Add a user-supplied networking contact for this job.
- **Auth**: Web only
- **Body**: `{ name (required, max 120), role?, contactType? (default OTHER), relationshipNote?, warmth? (0-100), profileUrl? }`
- **Response 201**: `{ contact }`
- **Errors**: `400`, `401`, `404`

### `POST /api/jobs/import/adzuna`
Search and bulk-import from the licensed Adzuna API.
- **Auth**: Web only
- **Rate limit**: `RATE_LIMITS.jobImportAdzuna`
- **Body**: `{ what?, where? }`
- **Response 200 (not configured)**: `{ configured: false }` — this is a normal 200, not an error, when `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` are unset
- **Response 200 (configured)**: `{ configured: true, imported: N, note? }` — the import loop checks AI budget per result and stops early (not erroring) if the budget runs out mid-batch
- **Gate**: `assertJobImportAllowed` (against Free-tier cap) → `402`
- **Errors**: `400`, `401`, `402`, `429`

---

## Job Sources

### `GET /api/job-sources`
List available job-import connectors and whether each is configured.
- **Auth**: Web only
- **Response 200**: `{ sources: [{ id, name, configured, description }] }` — never exposes actual key values, just booleans

---

## Applications

### `GET /api/applications`
- **Auth**: Dual
- **Response 200**: `{ applications: [{...job, score, notes, packageReady}] }` — `packageReady` means a cover letter has been generated but not yet fully approved

### `GET /api/applications/[id]`
- **Auth**: Dual
- **Response 200**: `{ application: {...}, resumeVersion: {...} | null }`
- **Errors**: `401`, `404`

### `PATCH /api/applications/[id]`
Update notes/approvals, or regenerate a piece of the application package.
- **Auth**: Dual
- **Body**: `{ resumeApproved?, coverLetterApproved?, qaApproved?, notes?, regenerate? ("resume"|"coverLetter"|"qa"), coverLetterText?, qaAnswerEdit? ({index, answer}) }`
- If `regenerate` is set: gate `assertProFeature("APPLICATION_PACKAGE")` → `402`; rate limit `RATE_LIMITS.applicationGeneration`; regenerated piece is automatically un-approved
- Manual text edits (`coverLetterText`/`qaAnswerEdit`) clear that piece's citations and un-approve it
- **Errors**: `400`, `401`, `402`, `404`, `429`

### `POST /api/applications/[id]/status`
Advance (or change) an application's pipeline status.
- **Auth**: Dual
- **Body**: `{ status }` (one of the 13 `ApplicationStatus` values)
- On first transition to `APPLIED`: sets `appliedAt`, auto-creates a `FollowUp`
- On transition to `INTERVIEW`/`FINAL_INTERVIEW`: auto-builds interview prep **only if** the user is Pro-entitled — silently skipped (not errored) otherwise
- **Response 200**: `{ status, appliedAt }`
- **Errors**: `400`, `401`, `404`

### `GET /api/applications/[id]/interview-prep`
- **Auth**: Dual
- If the application isn't at Interview stage: `{ interviewPrep: null, eligible: false }`
- If eligible but Free tier (and no prep exists yet): `200` with `{ interviewPrep: null, eligible: true, upgradeRequired: true, error }` — note this specific route returns the upgrade signal as a `200`, not a `402`
- Otherwise lazily creates the prep if missing, and returns the full serialized readiness/questions/STAR content
- **Errors**: `401`, `404`

### `PATCH /api/applications/[id]/interview-prep`
Set or clear the scheduled interview time.
- **Auth**: Dual
- **Body**: `{ scheduledAtLocal: "YYYY-MM-DDTHH:MM" | null }` — a local wall-clock string, converted to UTC using the user's saved `timezone` preference server-side
- **Gate**: `assertProFeature("INTERVIEW_PREP")` → `200` with `{ error, upgradeRequired: true }` — deliberately matches the GET convention above rather than this app's usual `402` shape, since the schedule picker this route serves is only ever rendered after GET has already reported `upgradeRequired: false`, and mobile's `apiFetch` discards a non-ok response's JSON body
- **Errors**: `400`, `401`, `404`

---

## Interview Questions

### `PATCH /api/interview-questions/[id]`
Toggle a question's rehearsed state.
- **Auth**: Dual
- **Body**: `{ rehearsed: boolean }`
- **Response 200**: `{ rehearsed }`
- **Errors**: `400`, `401`, `404`

### `POST /api/interview-questions/[id]/mock-attempt`
Submit a practice answer for scoring.
- **Auth**: Dual
- **Rate limit**: `RATE_LIMITS.mockInterviewScoring`
- **Body**: `{ responseText (1-4000 chars) }`
- **Response 200**: `{ attempt: { scoreRelevance, scoreClarity, scoreStructure, scoreCompleteness, feedback } }`
- **Errors**: `400`, `401`, `404`, `429`

---

## Contacts

### `GET /api/contacts`
- **Auth**: Dual
- **Response 200**: `{ contacts: [{...job title/company, messagesDrafted, messagesSent}] }`

### `GET /api/contacts/[id]`
- **Auth**: Dual
- **Response 200**: `{ contact: {..., messages keyed by type} }`
- **Errors**: `401`, `404`

### `PATCH /api/contacts/[id]`
- **Auth**: Dual
- **Body**: `{ name?, role?, contactType?, relationshipNote?, warmth?, profileUrl? }` (all optional/nullable)
- **Errors**: `400`, `401`, `404`

### `DELETE /api/contacts/[id]`
- **Auth**: Dual
- **Response 200**: `{ success: true }`
- **Errors**: `401`, `404`

### `POST /api/contacts/[id]/messages`
Generate an outreach message draft.
- **Auth**: Dual
- **Gate**: `assertProFeature("NETWORKING_OUTREACH")` → `402`
- **Rate limit**: `RATE_LIMITS.networkingGeneration`
- **Body**: `{ messageType, force? }`
- **Errors**: `400`, `401`, `402`, `404`, `429`

### `PATCH /api/contacts/[id]/messages`
Edit a draft, or mark one as sent — this is the **only** path that can set a message's status to `SENT`, and doing so never actually transmits anything; it's a manual confirmation that the user sent it themselves.
- **Auth**: Dual
- **Body**: `{ messageType (required), content? (max 3000), status? }`
- Manual content edits clear the message's citations
- **Errors**: `400`, `401`, `404` ("no draft exists" for that type)

---

## Follow-ups

### `GET /api/follow-ups`
- **Auth**: Dual
- **Query**: `applicationId?` (optional filter)
- **Response 200**: `{ followUps: [{..., isDue}] }` — `isDue` computed as `dueDate <= now` at read time

### `GET /api/follow-ups/[id]`
- **Auth**: Web only *(inconsistent with the parent `/api/follow-ups` route, which is Dual — see Known Issues)*
- **Errors**: `401`, `404`

### `PATCH /api/follow-ups/[id]`
- **Auth**: Web only
- **Body**: `{ dueDate?, status? }`
- **Errors**: `400`, `401`, `404`

### `POST /api/follow-ups/[id]/draft`
Generate an AI-drafted check-in message.
- **Auth**: Web only
- **Rate limit**: `RATE_LIMITS.followUpGeneration`
- **Body**: `{ force? }`
- **Response 200**: `{ draft }`
- **Errors**: `401`, `404`, `429`

---

## Resumes

### `GET /api/resumes`
- **Auth**: Web only
- **Response 200**: `{ resumes: [...metadata, no rawText] }`

### `POST /api/resumes`
Upload a resume file.
- **Auth**: Web only
- **Rate limit**: `RATE_LIMITS.resumeUpload`
- **Body**: `multipart/form-data`, field `file` — PDF or DOCX only, ≤10MB
- Extracts text, stores the file via the storage provider, creates a `ResumeDocument` (first upload becomes master), then extracts structured `CareerProfileEntry` rows via the AI provider (heuristic mock or real Claude)
- **Response 200**: `{ resume, profileEntriesCreated, warnings, conflicts }`
- **Errors**: `400` (bad file type/size), `401`, `429`, `500` (extraction failure)

### `DELETE /api/resumes/[id]`
- **Auth**: Web only
- **Response 200**: `{ success: true }`
- **Errors**: `401`, `404`

### `POST /api/resumes/[id]/set-master`
- **Auth**: Web only
- **Response 200**: `{ success: true }`
- **Errors**: `401`, `404`

---

## Career Profile

### `GET /api/profile`
- **Auth**: Web only
- **Response 200**: `{ sections: {...entries grouped by section}, counts: {VERIFIED, SUPPORTED_INFERENCE, NOT_VERIFIED, MISSING}, overallConfidence }`

### `POST /api/profile/entries`
Manually add a profile entry.
- **Auth**: Web only
- **Body**: `{ section, value (1-2000 chars), label? (max 200) }`
- Manually-added entries are hard-pinned to a fixed confidence level (no source document to validate against)
- **Response 201**: `{ entry }`
- **Errors**: `400`, `401`

### `PATCH /api/profile/entries/[id]`
- **Auth**: Web only
- **Body**: `{ value (1-2000), label? }`
- Re-validates against the source document if one exists — confidence can only stay the same or drop, never rise
- **Errors**: `400`, `401`, `404`

### `DELETE /api/profile/entries/[id]`
- **Auth**: Web only
- **Errors**: `401`, `404`

### `POST /api/profile/entries/[id]/confirm`
Mark an entry as user-confirmed.
- **Auth**: Web only
- **Response 200**: `{ entry }`
- **Errors**: `401`, `404`

---

## Preferences

### `GET /api/preferences`
- **Auth**: Web only
- **Response 200**: `{ preferences: { targetTitles, targetLocations, salaryFloor, workAuthorization, followUpDays, aiTrainingOptIn, timezone } }` (defaults if none set yet)

### `PUT /api/preferences`
- **Auth**: Web only
- **Body**: `{ targetTitles? (max 20), targetLocations? (max 20), salaryFloor? (int, nullable), workAuthorization? (nullable), followUpDays? (1-90), aiTrainingOptIn?, timezone? (validated IANA zone) }`
- **Errors**: `400`, `401`

---

## Analytics

### `GET /api/analytics`
- **Auth**: Dual
- **Response 200**: `{ summary: {...funnel counts, averages, sample sizes} }`
- **Errors**: `401`

---

## Assistant

### `POST /api/assistant/chat`
- **Auth**: Dual
- **Rate limit**: `RATE_LIMITS.assistantChat`; AI budget check → `429` before the body is even parsed
- **Body**: `{ message (1-1000 chars) }`
- Classifies intent, dispatches to one of 7 scoped DB-backed tool functions, phrases the result via the AI provider (or a generic fallback string on provider failure — still returns `200`)
- **Response 200**: `{ reply, intent, toolResults }`
- **Errors**: `400`, `401`, `429`

---

## Billing

### `GET /api/billing/status`
- **Auth**: Dual
- **Response 200**: `{ plan, status, jobsUsed, jobsCap, stripeConfigured }`

### `POST /api/billing/checkout`
- **Auth**: Dual
- **Response 200 (not configured)**: `{ configured: false }`
- **Response 200 (configured)**: `{ configured: true, url }` — Stripe Checkout Session URL
- **Response 502 (Stripe API failure)**: `{ configured: true, error }`

### `POST /api/billing/portal`
- **Auth**: Dual
- **Response 200 (not configured)**: `{ configured: false }`
- **Response 400 (no subscription yet)**: `{ error: "No billing account yet — subscribe to Pro first." }`
- **Response 200 (configured)**: `{ configured: true, url }`
- **Response 502**: `{ configured: true, error }`

### `POST /api/billing/webhook`
Stripe webhook receiver — the **only** writer of `Subscription.plan`/`status`/Stripe fields anywhere in the app.
- **Auth**: Special — verifies the `stripe-signature` header against the raw request body using `STRIPE_WEBHOOK_SECRET`
- **Response 400**: missing signature header, or signature verification fails
- **Response 501**: webhook not configured
- **Response 200**: `{ received: true }`
- Handles `customer.subscription.{created,updated,deleted}`

---

## Account

### `GET /api/account/export`
Full self-service data export.
- **Auth**: Dual
- **Response 200**: a raw JSON file download (`Content-Disposition: attachment`), aggregating every user-owned row across 15 models. Excludes `passwordHash`, the password-reset token hash, raw file bytes, and internal storage keys.
- **Errors**: `401`

### `DELETE /api/account`
Permanently delete the account and everything it owns.
- **Auth**: Dual
- **Rate limit**: 5/hour, keyed by user id
- **Body**: `{ password }` — must re-confirm the current password
- **Response 200**: `{ success: true }` — deletes all stored files, then the `User` row (cascades to every owned table via `onDelete: Cascade`)
- **Errors**: `400`, `401` (wrong password), `429`

---

## Push Tokens

### `POST /api/push-tokens`
Register a device for daily-briefing push notifications.
- **Auth**: Dual
- **Body**: `{ token, platform ("IOS"|"ANDROID"|"WEB") }`
- Upserts keyed on the token value alone (not user+token), so a token that moves to a different logged-in account is reassigned rather than rejected
- **Errors**: `400`, `401`

### `DELETE /api/push-tokens`
Unregister a device.
- **Auth**: Dual
- **Body**: `{ token }` — scoped so a user can never delete another user's token even if they somehow knew its value
- **Errors**: `400`, `401`

---

## Daily Briefing

### `GET /api/daily-briefing`
Fetch today's briefing content for the in-app card.
- **Auth**: Dual
- **Response 200**: `{ headline, lines, facts }` — `facts` is the same underlying data structure the push notification's copy is generated from
- **Errors**: `401`

---

## Cron

### `POST /api/cron/daily-briefing`
Hourly-triggered batch job that sends the daily briefing push notification to every eligible user.
- **Auth**: Special — `Authorization: Bearer <CRON_SECRET>`, compared with a timing-safe comparison (`crypto.timingSafeEqual`). Not tied to any single user's session.
- Not designed to be called manually by an end user; triggered by `.github/workflows/daily-briefing-cron.yml` once an hour
- For each user with a registered push token: computes their current local hour from their saved timezone, skips if outside their morning window or if today's briefing was already sent (`DailyBriefingLog` unique constraint is the concurrency-safe dedup signal), otherwise computes and sends
- **Response 200**: `{ processed, sent, skipped }`
- **Errors**: `401`

---

## Health

### `GET /api/health`
Unauthenticated health check for deployment platforms/uptime monitors.
- **Auth**: None (intentionally public)
- **Response 200**: `{ status: "ok", database: "ok" }` — confirms a real DB round trip (`SELECT 1`), not just that the process is up
- **Response 503**: `{ status: "error", database: "unreachable" }`

---

## Cross-cutting notes

- **Rate limiting** is implemented two ways: `checkRateLimit` (simple IP- or user-keyed fixed window, used on auth/account-security endpoints) and `checkUserAndGlobalRateLimit` (per-user *and* global caps together, used on every AI-generation endpoint — configured centrally in `lib/security/rateLimits.config.ts`).
- **AI budget** (`checkAIBudget`) is layered on top of Pro-tier gates on every route that calls the AI provider, capping daily spend per user regardless of how many individual rate limits that user is under.
- The full list of routes that are **web-only and not reachable from the mobile app** is documented in [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md), since it's a real, unintentional-looking inconsistency worth tracking as a gap rather than a design decision.
