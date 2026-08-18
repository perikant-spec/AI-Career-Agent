# User Guide

A practical, feature-by-feature walkthrough of how to actually use AI Career Agent, based on what the current app does — not a marketing description. Screens are named as they appear in the product; API routes are noted in parentheses for anyone cross-referencing `docs/API.md`.

## Getting started

**Prerequisite**: none — just an email address and a password (min 8 characters).

1. Go to **Register**, enter your name (optional), email, and password, and accept the Terms and Privacy checkbox (required).
2. You're signed in automatically and taken straight to **Step 1 of 3 · Resume** — the app's onboarding flow starts here, not at an empty dashboard.
3. Drag and drop, or pick, a resume file — **PDF or DOCX only**. If yours is a scanned image, this won't extract text from it; you'll need to add your background manually via the Career Profile page instead (see below).
4. Watch the live progress: Uploading → Extracting text → Building career profile. When it finishes, you'll see how many fields were found, and a callout if anything came back low-confidence or ambiguous.
5. Two optional next steps are offered here: **"Add now"** (search preferences — target titles, locations, salary floor) or **"Skip to jobs"** (only enabled once extraction has actually succeeded).

**Expected outcome**: a signed-in account with a resume parsed into a structured Career Profile, ready to score jobs against.

## Reviewing your Career Profile

**Prerequisite**: at least one resume uploaded.

Go to **Career Profile**. Entries are grouped into Summary, Experience, Skill, Education, Certification, and Achievement. Each one carries a confidence badge:

- **Verified** — found directly in your resume text.
- **Supported inference** — implied by the text but not stated outright; shown explicitly as an inference, not a fact.
- **Missing** — something the app looked for and didn't find.

You can edit, confirm, delete, or manually add entries. A manually-added entry is capped at a lower confidence level automatically — you can't self-declare something as "Verified" without a source document behind it. Everything generated later (tailored resumes, cover letters, outreach messages, interview answers) draws only from what's here, so this page is worth reviewing before you start applying.

## Finding and scoring jobs

**Prerequisite**: a resume uploaded (an empty profile will still score jobs, just with much less signal).

Go to **Jobs**. Paste the full text of a job posting into the import box (there's no "paste a URL and we'll fetch it" option — the app never scrapes pages on your behalf) and submit. If your account is set up with an Adzuna API key (Settings → Job sources), you can also search Adzuna's licensed job listings directly.

Each imported job appears in your feed with a match score and a recommendation tier: **Apply Strong**, **Apply**, **Apply If Interested**, **Low Priority**, or **Don't Apply** (the last two can also include hard disqualifiers — e.g. a certification you don't have that the posting requires). Click into a job to see the full category breakdown (skills, experience, seniority, industry, location, compensation, education, career trajectory), your strengths and gaps against it, and the original posting text.

**Free plan limit**: you can track up to 5 jobs at a time. Beyond that, you'll be prompted to upgrade to Pro.

## Preparing and submitting an application

**Prerequisite**: a scored job, and a Pro subscription (this step is gated).

From a job's detail page, click **"Prepare application."** This generates a tailored resume (reordered/rephrased from your master resume — never content that wasn't already there), a cover letter, and screening Q&A answers.

In the **Application workspace** (reached automatically, or from the Applications list), review each of the three pieces on its own tab. You can edit the cover letter and Q&A answers directly, or regenerate any piece. Each piece has its own **Approve** action — all three need to be approved independently before the application is considered ready.

When you've actually submitted the application on the employer's own site, come back and click **"I applied on the employer's site."** This is the only thing that moves an application to `Applied` status — nothing in this app submits an application anywhere for you.

## Tracking your pipeline

Go to **Applications**. Switch between a **Kanban board** (drag-free — status changes happen via a dropdown, not drag-and-drop) and a **List view**; both reflect the same 13-stage pipeline (`Discovered → Shortlisted → Preparing → Ready to Apply → Applied → Recruiter Contact → Screening → Interview → Final Interview → Offer → Accepted`, plus `Rejected`/`Withdrawn`). Every status change is something you do explicitly — nothing advances automatically based on time or any external signal.

## Networking and outreach

**Prerequisite**: an application in progress, and Pro for message generation (adding a contact itself is free).

From inside an application's workspace, add a contact yourself — name, role, how you know them, and optionally a 0–100 "warmth" rating. The app never looks up or guesses who a company's hiring manager is; you always supply this.

From **Networking**, open a contact and generate a draft for any of six message types (connection request, after-connect, recruiter message, hiring-manager message, referral ask, follow-up). Edit it, copy it out, and send it yourself from your own email or LinkedIn account — then come back and click **"Mark as sent"** so the app's records stay accurate. Nothing here has the technical ability to send a message on your behalf.

## Follow-ups

The moment you mark an application `Applied`, a follow-up reminder is scheduled automatically — by default 7 days later (change this in Settings → Search preferences → "Follow up after"). It's a fixed timer, not something that adapts based on how quickly companies typically respond. You can generate an AI-drafted check-in message for it, which states how long it's been since you applied but never speculates about *why* you haven't heard back — that would be a claim about the employer this app has no way to actually know.

## Interview preparation

**Prerequisite**: an application at Interview or Final Interview status, and Pro.

The moment an application reaches Interview stage, a prep workspace is built automatically: company research pulled from the job posting's own text (if the posting didn't mention much about the company, this section will honestly be sparse rather than making something up), a bank of behavioral/technical/role-specific/leadership/company-fit questions with model STAR-format answers derived from your resume, and a rehearsed/not-rehearsed toggle per question.

You can also set (or clear) a real interview date and time here — it's stored using your account's timezone (set in Settings), and will show up correctly in your Daily Briefing. If you never set a time, the briefing will honestly say "you have an upcoming interview" rather than inventing one.

Type a practice answer to any question and submit it for scoring — you'll get back relevance, clarity, structure, and completeness scores plus written feedback, based only on what you actually typed.

## The Assistant

Go to **Assistant** (this is also your home/dashboard page). Type a question, or click one of the suggested prompts: *"What should I apply to today?"*, *"Why was this job marked don't apply?"*, *"Prepare my application for this job"*, *"Have I applied here before?"*, *"Why am I not hearing back?"*, *"Prepare me for my interview."* Each of these is answered by a specific, scoped lookup against your own data — the assistant never invents a claim about your applications, and if there isn't enough data yet for a meaningful answer (e.g. comparing response rates with too few applications), it says so plainly instead of guessing.

## Daily Briefing

A card on both the Assistant page (web) and Home screen (mobile) summarizes: how many new jobs matched since your last briefing, how many are high priority, follow-ups due today, a hiring manager worth reaching out to (if one exists with no outreach sent yet), and your next interview. On **mobile only**, you can also opt into this arriving as a real push notification — go to Settings and toggle "Daily briefing notifications" (you'll be asked to grant notification permission). This toggle doesn't exist on the web version, since a browser tab can't receive push notifications the same way.

## Analytics

Go to **Analytics** for a read-only view of your funnel: average match score, average ATS score, average days-to-apply, and rejected/withdrawn count, each with its own sample size shown rather than a potentially misleading number. The funnel reflects each application's *current* stage — since the app doesn't log status-change history, it can't tell you how many applications ever passed through a given stage before moving on.

## Settings

- **Account** — your name/email (read-only here).
- **Billing** — see your current plan, usage against the Free-tier job cap, and upgrade to Pro or manage an existing subscription via Stripe's own billing portal.
- **Search preferences** — target titles/locations, salary floor, work authorization, follow-up timing, and your timezone (used for interview times and briefing delivery).
- **Job sources** — see which import sources are connected (manual paste is always available; Adzuna only if configured).
- **Privacy & data** — toggle whether your data can be used to improve AI models (off by default — and as of today, there's no training pipeline that would actually use this even if enabled), export everything the app has stored about you as a JSON file, or permanently delete your account (requires re-entering your password).

## Using the mobile app

The mobile app (iOS/Android/Expo web) shares your exact same account and data — sign in with the same email and password. It covers: Home (dashboard + briefing + assistant chat), Jobs (browse and score — **importing new jobs is web-only**), Applications (review and progress status — **no Kanban board, no editing generated text, no regenerate button**), Networking (draft and mark-sent — **no editing a draft or copying to clipboard**), Interviews (full parity with web, including scheduling), and Settings (account, sign out, delete account, plus the push-notification toggle that web doesn't have).

**Not available on mobile at all**: uploading a resume, viewing or editing your Career Profile, the Analytics dashboard, billing/upgrade, editing search preferences, the AI-training toggle, exporting your data, and password reset. The mobile app itself tells you this directly in its own Settings screen: *"Resume uploads, profile edits, and full application-package review are best done on the web for now."*
