import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { createWebSession } from "./helpers/webSession";

// Full-stack acceptance test against a *running* dev/staging server (see BASE_URL) and its real
// Postgres database — this is deliberately an HTTP-level test, not a mocked unit test, because
// the thing being proven is that the whole stack (Next.js route handlers -> Prisma -> Postgres)
// actually persists and returns real data end-to-end after the SQLite -> Postgres migration.
// Requires the dev server to be running (`npm run dev`) against a real DATABASE_URL. CI runs
// this as a separate "integration" step, after boot, not as part of the fast unit-test pass.
//
// Auth note: this codebase has two valid, real auth paths — the web NextAuth cookie session, and
// the mobile Bearer JWT (lib/auth/resolveUserId.ts accepts either). Several routes are
// deliberately web-only today (resume upload, career-profile editing, preferences, Adzuna
// import, job resume-version/rescore/contacts) — a real, documented scope decision from
// Milestone 11 ("resume uploads and profile edits are best done on the web for now"), not a
// bug — so this test authenticates each step with whichever mechanism that route actually
// accepts, exactly as a real user's web session or mobile app would.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// A dev server compiles each route on first hit (can take 15-20s) — a pre-built production/CI
// server wouldn't need this, but this file is also the local verification pass against
// `next dev`, so every step gets a generous timeout.
const STEP_TIMEOUT = 30000;

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

const SAMPLE_JOB_TEXT = `Group Product Manager

Globex is hiring a Group Product Manager to own our activation roadmap.

Location: Remote (US)
Salary: $150,000 - $180,000

Required:
- 6+ years of product management experience
- Strong SQL and stakeholder management skills
- Experience with roadmapping and A/B testing

Preferred:
- Familiarity with Jira and experimentation platforms

This is a senior role. No visa sponsorship is available for this position.`;

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON (status ${res.status}), got: ${text.slice(0, 300)}`);
  }
}

describe.runIf(await serverReachable())("Full acceptance workflow (signup -> tracking) against Postgres", () => {
  const email = `e2e-postgres-${Date.now()}@example.com`;
  const password = "e2eTestPass123";
  let cookie: string;
  let token: string;
  let userId: string;
  let jobId: string;
  let applicationId: string;
  let contactId: string;

  function web(path: string, init: RequestInit = {}) {
    return fetch(`${BASE_URL}${path}`, { ...init, headers: { Cookie: cookie, ...(init.headers ?? {}) } });
  }
  function mobile(path: string, init: RequestInit = {}) {
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  }

  beforeAll(async () => {
    expect(await serverReachable()).toBe(true);
  });

  // Cascading delete (onDelete: Cascade on every user-owned relation) cleans up every row this
  // test created — same mechanism account deletion uses in production — so re-running this
  // suite repeatedly never accumulates throwaway users in a shared dev database.
  afterAll(async () => {
    if (!userId) return;
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it(
    "1. signs up a new user (web) and establishes both a web session and a mobile token",
    async () => {
      const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "Jordan Rivera" }),
      });
      expect(registerRes.status).toBe(201);
      const registerBody = await json<{ user: { id: string } }>(registerRes);
      userId = registerBody.user.id;

      cookie = await createWebSession(BASE_URL, email, password);

      const loginRes = await fetch(`${BASE_URL}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      expect(loginRes.status).toBe(200);
      const loginBody = await json<{ token: string }>(loginRes);
      token = loginBody.token;
    },
    STEP_TIMEOUT
  );

  it(
    "2. uploads a real resume file (web session, multipart) and it persists",
    async () => {
      const fileBytes = await readFile(path.resolve(__dirname, "..", "fixtures", "resumes", "sample-resume.pdf"));
      const form = new FormData();
      form.append("file", new Blob([fileBytes], { type: "application/pdf" }), "resume.pdf");

      const res = await web("/api/resumes", { method: "POST", body: form });
      expect(res.status).toBe(200);
      const body = await json<{ resume: { extractionStatus: string }; profileEntriesCreated: number }>(res);
      expect(body.resume.extractionStatus).toBe("SUCCESS");
      expect(body.profileEntriesCreated).toBeGreaterThan(0);
    },
    STEP_TIMEOUT
  );

  it(
    "3. career profile reflects entries extracted from the uploaded resume",
    async () => {
      const res = await web("/api/profile");
      expect(res.status).toBe(200);
      const body = await json<{ totalEntries: number; sections: Record<string, Array<{ value: string }>> }>(res);
      expect(body.totalEntries).toBeGreaterThan(0);
      const allValues = Object.values(body.sections).flat().map((e) => e.value);
      expect(allValues.some((v) => /SQL/i.test(v))).toBe(true);
    },
    STEP_TIMEOUT
  );

  it(
    "4. imports a job (mobile Bearer token) and it persists with a computed match score",
    async () => {
      const res = await mobile("/api/jobs", { method: "POST", body: JSON.stringify({ rawText: SAMPLE_JOB_TEXT }) });
      expect(res.status).toBe(200);
      const body = await json<{ job: { id: string }; matchScore: { overallScore: number } }>(res);
      jobId = body.job.id;
      expect(jobId).toBeTruthy();
      expect(typeof body.matchScore.overallScore).toBe("number");
    },
    STEP_TIMEOUT
  );

  it(
    "5. match score is retrievable from the job detail endpoint",
    async () => {
      const res = await mobile(`/api/jobs/${jobId}`);
      expect(res.status).toBe(200);
      const body = await json<{ matchScore: { overallScore: number; recommendationTier: string } | null }>(res);
      expect(body.matchScore).not.toBeNull();
      expect(body.matchScore!.recommendationTier).toBeTruthy();
    },
    STEP_TIMEOUT
  );

  it(
    "5b. upgrades the test account to Pro (simulated directly in the DB, the same way the Stripe webhook would) so the remaining Pro-gated workflow steps can be exercised",
    async () => {
      const { prisma } = await import("@/lib/prisma");
      await prisma.subscription.upsert({
        where: { userId },
        create: { userId, plan: "PRO", status: "ACTIVE" },
        update: { plan: "PRO", status: "ACTIVE" },
      });
      const res = await mobile("/api/billing/status");
      const body = await json<{ plan: string }>(res);
      expect(body.plan).toBe("PRO");
    },
    STEP_TIMEOUT
  );

  it(
    "6. prepares a job-specific application package (resume, cover letter, Q&A)",
    async () => {
      const res = await mobile(`/api/jobs/${jobId}/apply`, { method: "POST" });
      expect(res.status).toBe(200);
      const body = await json<{ applicationId: string }>(res);
      applicationId = body.applicationId;
      expect(applicationId).toBeTruthy();
    },
    STEP_TIMEOUT
  );

  it(
    "7. application package persisted with a tailored resume version and cover letter",
    async () => {
      const res = await mobile(`/api/applications/${applicationId}`);
      expect(res.status).toBe(200);
      const body = await json<{
        application: { coverLetter: { content: string } | null };
        resumeVersion: { content: unknown; atsScoreBefore: number; atsScoreAfter: number } | null;
      }>(res);
      expect(body.resumeVersion).not.toBeNull();
      expect(body.application.coverLetter).not.toBeNull();
    },
    STEP_TIMEOUT
  );

  it(
    "8. adds a contact (web session) and drafts a networking outreach message (mobile Bearer token)",
    async () => {
      const contactRes = await web(`/api/jobs/${jobId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dana Reyes", contactType: "HIRING_MANAGER" }),
      });
      expect(contactRes.status).toBe(201);
      const contactBody = await json<{ contact: { id: string } }>(contactRes);
      contactId = contactBody.contact.id;

      const draftRes = await mobile(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messageType: "CONNECTION_REQUEST" }),
      });
      expect(draftRes.status).toBe(200);
      const draftBody = await json<{ message: { content: string } }>(draftRes);
      expect(draftBody.message.content.length).toBeGreaterThan(0);
    },
    STEP_TIMEOUT
  );

  it(
    "9. advances application status (tracking, mobile Bearer token) and it persists",
    async () => {
      const res = await mobile(`/api/applications/${applicationId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "APPLIED" }),
      });
      expect(res.status).toBe(200);

      const check = await mobile(`/api/applications/${applicationId}`);
      const body = await json<{ application: { status: string; appliedAt: string | null } }>(check);
      expect(body.application.status).toBe("APPLIED");
      expect(body.application.appliedAt).not.toBeNull();
    },
    STEP_TIMEOUT
  );

  it(
    "10. every record from this workflow is verifiably present directly in Postgres",
    async () => {
      const { prisma } = await import("@/lib/prisma");
      const [user, entries, resumeDoc, job, application, contact] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.careerProfileEntry.count({ where: { userId } }),
        prisma.resumeDocument.findFirst({ where: { userId } }),
        prisma.job.findUnique({ where: { id: jobId } }),
        prisma.application.findUnique({ where: { id: applicationId } }),
        prisma.contact.findUnique({ where: { id: contactId } }),
      ]);
      expect(user?.email).toBe(email);
      expect(entries).toBeGreaterThan(0);
      expect(resumeDoc?.extractionStatus).toBe("SUCCESS");
      expect(job?.userId).toBe(userId);
      expect(application?.status).toBe("APPLIED");
      expect(contact?.name).toBe("Dana Reyes");
    },
    STEP_TIMEOUT
  );
});
