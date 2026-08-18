# Product

## Purpose

AI Career Agent manages the mechanics of a job search end-to-end: parsing a resume into a structured, evidence-backed career profile; scoring job postings against that profile; tailoring a resume and generating a full application package for a specific job; drafting networking outreach; tracking follow-ups; building interview preparation; and tying all of it together through a chat assistant with real analytics over the user's own data.

The product's defining constraint, applied consistently across every feature, is a hard **evidence layer**: every claim the app makes about a candidate is checked against what their actual resume/profile text says (`lib/evidence/`), and a claim's confidence can only ever be downgraded on re-validation, never upgraded. Nothing about the candidate is invented. Layered on top of that is a **human-in-the-loop boundary**: the agent drafts and prepares; the user reviews, edits, and is the one who actually sends a message or submits an application. No code path in this codebase transmits an outreach message or submits a job application on the user's behalf.

## Target users

Individual job seekers managing an active search across multiple companies at once — the product is built around tracking many jobs/applications in parallel (a feed, a pipeline tracker, per-contact outreach), not a single application. There is no employer-side, recruiter-side, or team/organization functionality anywhere in the codebase.

## User roles

There is **no role-based access control** in this application — no admin role, no team/org membership, no multi-user accounts. The only axis of differentiation between users is their **subscription plan**:

- **Free** (the default for every account — a `Subscription` row is lazily created with `plan: "FREE"` on first check, no separate signup step): unlimited resume/profile/job-scoring use, plus tracking up to 5 jobs at once.
- **Pro**: unlimited job tracking, plus three gated capabilities — generating a full application package (tailored resume, cover letter, screening Q&A), drafting networking outreach messages, and building interview preparation (company research, STAR answers, mock-interview scoring). Requires an `ACTIVE` or `TRIALING` Stripe subscription status (`PAST_DUE` does **not** count as entitled).

Every Pro-gated action is enforced server-side, on both web and mobile, returning a consistent "upgrade required" signal that both clients render as an upgrade prompt — this is never enforced only in the UI.

## Core user journeys

### 1. Onboarding: from signup to a scored job
Register (email, password, name, required Terms/Privacy acceptance) → auto-signed-in → routed directly into a 3-step-labeled wizard starting at resume upload (`/resumes/upload`, explicitly "Step 1 of 3 · Resume") → resume is parsed into career-profile entries with confidence levels shown live → optional detour to set search preferences → paste a job posting → get an immediate match score.

### 2. Deciding what to apply to
Paste job postings (manual text paste or URL reference only — the app never scrapes a URL server-side; optionally, licensed Adzuna API search if configured) → each is scored against the profile with a tier (`Apply Strong` / `Apply` / `Apply If Interested` / `Low Priority` / `Don't Apply`, the last two including any hard disqualifiers) → the Assistant chat or its suggested-question chips can also answer "what should I apply to today?" directly.

### 3. Preparing and submitting an application
From a scored job, "Prepare application" generates a tailored resume, cover letter, and screening Q&A answers (Pro) → the user reviews each piece in the Application workspace, edits as needed, and explicitly approves each one independently → once all three are approved the application can move to "Ready to Apply" → a dedicated **"I applied on the employer's site"** button is the only thing that sets status to `Applied` — this app never submits an application anywhere on the user's behalf.

### 4. Tracking the pipeline
The Applications page offers a Kanban board or a list view over the same 13-stage pipeline (`Discovered → Shortlisted → Preparing → Ready to Apply → Applied → Recruiter Contact → Screening → Interview → Final Interview → Offer → Accepted`, plus `Rejected`/`Withdrawn`). Every status change is an explicit user action — there is no automatic status advancement anywhere.

### 5. Networking
From within an application, the user manually adds a contact (name, role, relationship note, optional warmth rating) — the app never auto-discovers who a hiring manager or recruiter is. For each contact, up to six types of outreach message can be drafted (Pro), edited, and copied out; "Mark as sent" is a manual confirmation with no actual message transmission behind it.

### 6. Following up
The moment an application first reaches `Applied`, a follow-up reminder is auto-scheduled (a fixed number of days later, configurable in Settings, default 7 — not adaptive to response patterns). An AI-drafted check-in message can be generated per follow-up (states the real days-since-applied fact, never speculates about why there's been no response).

### 7. Interview preparation
The moment an application first reaches `Interview` or `Final Interview` status, a full prep workspace is auto-built (Pro): company research extracted from the job posting's own text, a bank of behavioral/technical/role-specific/leadership/company-fit questions with STAR-format model answers derived from the resume, a rehearsed/not-rehearsed toggle per question, and mock-answer scoring against the user's own typed practice response. An optional real interview date/time can be scheduled, stored timezone-aware, and surfaced in the daily briefing.

### 8. Staying on top of it day to day
The Assistant home page functions as a daily dashboard (new matches, applications ready for review, live applications, follow-ups due) plus a chat interface. A daily briefing — a deterministic, template-based summary of new matches, high-priority jobs, follow-ups due, a hiring manager worth contacting, and any upcoming interview — appears as a card on both web and mobile, and can additionally arrive as a real push notification on mobile if the user opts in.

## Feature-by-feature description

| Feature | Status | Notes |
|---|---|---|
| Resume upload & parsing | **Implemented** | PDF/DOCX only; scanned/image-only files aren't supported (paste text as a fallback career-profile entry instead) |
| Career Profile (evidence-backed) | **Implemented** | Every entry traceable to a source span or explicitly marked as inference; downgrade-only confidence |
| Job import (manual paste) | **Implemented** | No URL scraping anywhere |
| Job import (Adzuna) | **Implemented, requires configuration** | Inert with an honest "not connected" state until `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` are set |
| Match scoring | **Implemented** | Deterministic, pure-function scoring engine; AI only phrases the rationale when configured |
| Resume customization (tailored resume) | **Implemented** | Reorders/rephrases only — never introduces a new claim not already in the master profile |
| Application package (cover letter, Q&A) | **Implemented** | Pro feature |
| Application tracker (Kanban + list) | **Implemented** | Manual status changes only |
| Networking / outreach drafting | **Implemented** | Pro feature; contacts always user-supplied, no auto-discovery; no reply tracking |
| Follow-up reminders | **Implemented** | Fixed timer, not adaptive; "due" computed at read time |
| Interview preparation | **Implemented** | Pro feature; deterministic STAR content; one real AI call (mock-response scoring) |
| Interview scheduling (real date/time) | **Implemented** | Timezone-aware; never fabricated if unset |
| Central AI Assistant (chat) | **Implemented** | 8 intents, all routed to scoped DB-backed tools, never free-form generation |
| Analytics | **Implemented** | Current-status funnel snapshot with explicit sample-size honesty; not a true historical funnel (no status-change history is logged) |
| Daily Briefing (in-app) | **Implemented** | Web + mobile, deterministic narrative |
| Daily Briefing (push notification) | **Implemented, mobile only** | Real Expo push; opt-in toggle only exists on mobile Settings |
| Billing (Stripe, Free/Pro) | **Implemented, requires configuration** | Fully functional Free-tier product with an honest "Stripe not connected" state until keys are set |
| Data export | **Implemented, web only** | Full JSON export of everything the app stores about the user |
| Account deletion | **Implemented** | Password-confirmed, cascading, available on both web and mobile |
| Email delivery (password reset, notifications) | **Not implemented (real send)** | Fully coded flow, but no real provider is wired in — see Limitations |
| Email verification at signup | **Not implemented** | No verification step exists at all |
| Legal document content (Terms/Privacy) | **Not implemented (content)** | Pages exist and render correctly, but the actual legal text has not been written |
| In-app feedback/support channel | **Not implemented** | No mechanism anywhere in the app for a user to report a bug or ask a question |
| Error/crash monitoring | **Not implemented** | No third-party error-tracking SDK on web or mobile |

## Business rules (as enforced in code, not aspirational)

- A candidate-facing claim's confidence level (`VERIFIED` / `SUPPORTED_INFERENCE` / `NOT_VERIFIED` / `MISSING`) can be downgraded on re-validation but never upgraded.
- A manually-added profile entry (no source resume to validate against) is permanently pinned to a fixed, non-`VERIFIED` confidence level — a user cannot self-declare their own claim as verified.
- A job's hard disqualifiers force `Don't Apply` regardless of what the numeric score would otherwise be.
- An application can only reach `Ready to Apply` once the resume, cover letter, and Q&A pieces have each been **independently** approved by the user.
- `Applied` status can only be set by the user's own explicit "I applied on the employer's site" confirmation — no other code path sets it.
- An outreach message's `SENT` status can only be set by an explicit "mark as sent" action — no code path in the application actually dispatches a message to anyone.
- The Free plan is capped at 5 tracked jobs; every Pro-gated feature returns a consistent `402`/`upgradeRequired: true` signal enforced server-side, never only hidden client-side.
- A user's own password reset request returns identical wording whether or not the email is registered (prevents account enumeration).
- Cross-tenant resource access always returns `404`, never `403` — the app never confirms that a resource exists for a user who doesn't own it.
- Deleting an account is a real, cascading, irreversible deletion (password-reconfirmed) — there is no soft-delete/undo anywhere in the schema.

## Current limitations

These are real, verified gaps in the current build — not speculation:

- **Real email delivery does not exist.** Password-reset and any other transactional email is written to a log table and viewable only in a development-only debug page. A deployed instance cannot currently get a reset link to a real user's inbox.
- **No email verification at registration.** Any email address, including a typo'd or fake one, is accepted at signup.
- **Legal pages have no real content.** The Terms and Privacy pages render, and the consent-tracking mechanism (acceptance timestamp + version) works, but the actual document text has not been written (`body: null` in the source).
- **Local-disk file storage does not persist across redeploys** on most hosting platforms, unless real S3-compatible storage is explicitly configured — this is the default fallback, not an opt-in.
- **No hosting platform has been chosen or deployed to yet** — everything above describes what the running application does locally / in CI, not a live production instance.
- **No error monitoring or crash reporting** exists anywhere (web or mobile) — production errors are only visible via whatever platform captures stdout logs.
- **No in-app feedback or support channel** exists for a user to report a problem or ask a question.
- **The mobile app is missing several web features entirely**: resume upload, career profile viewing/editing, the resumes list, the analytics dashboard, billing/upgrade flow, search-preferences editing, the AI-training opt-in toggle, data export, job import, the Kanban board view, editing/regenerating cover letter or Q&A text, and adding new networking contacts. See `USER-GUIDE.md` for the full parity table.
- **The mobile app has never been built for a real device or submitted to an app store** — verified only via the Expo web target; no bundle identifiers, no `eas.json`, no store listing content exist yet.
- **No status-change history is recorded** — Analytics can only ever describe the current state of the pipeline, never a true historical funnel.
- **Follow-up timing is a fixed timer**, not adaptive to actual response patterns, by explicit design-for-now.
- **A handful of API routes only support web sessions, not mobile Bearer tokens**, inconsistently with the rest of the API surface — see `KNOWN-ISSUES.md` for the specific list.

## Future opportunities (explicitly not built — do not confuse with the above)

Everything in this section is either mentioned in code comments as a deliberately deferred later phase, or a logical extension the current architecture already anticipates — **none of it exists today**:

- A real email provider (Resend or similar) wired into the existing `lib/mail/` swap point — the abstraction is already built for this, only the provider branch is missing.
- Adaptive, response-rate-informed follow-up timing instead of the current fixed offset.
- Licensed contact-enrichment auto-discovery (e.g. Apollo/Hunter/ContactOut) — the `Contact.source` field already has a `PROVIDER_VERIFIED` value defined for this, with no code path that produces it yet.
- A true historical funnel with status-change history, rather than a current-status snapshot.
- Error/crash monitoring integration (Sentry/Axiom/Datadog or similar) — `lib/logging/` is already structured as a swap-point provider for this.
- Reply tracking for sent outreach messages (would require real email/inbox integration).
- Native mobile builds (TestFlight/Play Store), including app icons/splash screens beyond Expo's scaffold defaults.
- Mobile parity for the web-only features listed above.
- A shared, multi-instance-safe rate limiter (Redis/Upstash) — the current limiter is explicitly documented as a single-instance-only MVP implementation.
