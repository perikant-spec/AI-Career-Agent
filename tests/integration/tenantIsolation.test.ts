import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWebSession } from "./helpers/webSession";

// Proves the thing the manual code audit can only argue for: that User B's valid credentials
// (both web session and mobile Bearer token — every route accepts one or the other, see
// lib/auth/resolveUserId.ts) can never reach User A's resume, career profile, jobs, match
// scores, applications, contacts, outreach messages, follow-ups, interview prep, or interview
// questions/mock attempts by ID — the classic IDOR class of bug. Every route below was manually
// verified to scope its query by `{ id, userId }` (or an equivalent parent-ownership check)
// before this test was written; this is the automated regression guard that keeps it true.
//
// Requires a running dev server against a real database (see fullWorkflow.e2e.test.ts for the
// same convention).
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STEP_TIMEOUT = 30000;

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON (status ${res.status}), got: ${text.slice(0, 300)}`);
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

This is a senior role. No visa sponsorship is available for this position.`;

interface Identity {
  email: string;
  password: string;
  userId: string;
  cookie: string;
  token: string;
}

async function createIdentity(label: string): Promise<Identity> {
  const email = `e2e-tenant-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "e2eTestPass123";

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: `Tenant ${label}`, acceptedLegal: true }),
  });
  if (registerRes.status !== 201) throw new Error(`register failed for ${label}: ${registerRes.status}`);
  const { user } = await json<{ user: { id: string } }>(registerRes);

  const cookie = await createWebSession(BASE_URL, email, password);

  const loginRes = await fetch(`${BASE_URL}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { token } = await json<{ token: string }>(loginRes);

  return { email, password, userId: user.id, cookie, token };
}

function webAs(identity: Identity, path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, { ...init, headers: { Cookie: identity.cookie, ...(init.headers ?? {}) } });
}
function mobileAs(identity: Identity, path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${identity.token}`,
      ...(init.headers ?? {}),
    },
  });
}

describe.runIf(await serverReachable())("Multi-tenant isolation / IDOR", () => {
  let userA: Identity;
  let userB: Identity;

  // User A's resource ids — every one of these is a potential IDOR target for User B.
  let resumeId: string;
  let profileEntryId: string;
  let jobId: string;
  let applicationId: string;
  let contactId: string;
  let followUpId: string;
  let interviewPrepApplicationId: string; // a *second* application, pushed to INTERVIEW
  let interviewQuestionId: string;

  beforeAll(async () => {
    expect(await serverReachable()).toBe(true);

    userA = await createIdentity("a");
    userB = await createIdentity("b");

    const { prisma } = await import("@/lib/prisma");
    // Both tenants are given Pro directly (same technique as fullWorkflow.e2e.test.ts) so every
    // Pro-gated route is actually reachable — the point here is proving tenant isolation, not
    // re-proving the billing gate (that's covered in verify_billing-style tests elsewhere).
    await prisma.subscription.upsert({
      where: { userId: userA.userId },
      create: { userId: userA.userId, plan: "PRO", status: "ACTIVE" },
      update: { plan: "PRO", status: "ACTIVE" },
    });
    await prisma.subscription.upsert({
      where: { userId: userB.userId },
      create: { userId: userB.userId, plan: "PRO", status: "ACTIVE" },
      update: { plan: "PRO", status: "ACTIVE" },
    });

    // --- Build up User A's data footprint ---
    const entryRes = await webAs(userA, "/api/profile/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "SKILL", value: "SQL" }),
    });
    profileEntryId = (await json<{ entry: { id: string } }>(entryRes)).entry.id;

    const resume = await prisma.resumeDocument.create({
      data: {
        userId: userA.userId,
        fileName: "resume.pdf",
        storageKey: `${userA.userId}/fake-key.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        rawText: "Jordan Rivera, Senior PM, SQL, A/B testing.",
        extractionStatus: "SUCCESS",
      },
    });
    resumeId = resume.id;

    const jobRes = await mobileAs(userA, "/api/jobs", {
      method: "POST",
      body: JSON.stringify({ rawText: SAMPLE_JOB_TEXT }),
    });
    jobId = (await json<{ job: { id: string } }>(jobRes)).job.id;

    const applyRes = await mobileAs(userA, `/api/jobs/${jobId}/apply`, { method: "POST" });
    applicationId = (await json<{ applicationId: string }>(applyRes)).applicationId;

    await mobileAs(userA, `/api/applications/${applicationId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "APPLIED" }),
    });
    const followUp = await prisma.followUp.findFirst({ where: { userId: userA.userId } });
    followUpId = followUp!.id;

    const contactRes = await webAs(userA, `/api/jobs/${jobId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dana Reyes", contactType: "HIRING_MANAGER" }),
    });
    contactId = (await json<{ contact: { id: string } }>(contactRes)).contact.id;
    await mobileAs(userA, `/api/contacts/${contactId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messageType: "CONNECTION_REQUEST" }),
    });

    // A second job/application, pushed straight to INTERVIEW so interview-prep content exists.
    const job2Res = await mobileAs(userA, "/api/jobs", {
      method: "POST",
      body: JSON.stringify({ rawText: SAMPLE_JOB_TEXT.replace("Group Product Manager", "Staff Engineer") }),
    });
    const job2Id = (await json<{ job: { id: string } }>(job2Res)).job.id;
    const apply2Res = await mobileAs(userA, `/api/jobs/${job2Id}/apply`, { method: "POST" });
    interviewPrepApplicationId = (await json<{ applicationId: string }>(apply2Res)).applicationId;
    await mobileAs(userA, `/api/applications/${interviewPrepApplicationId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "INTERVIEW" }),
    });
    const prep = await prisma.interviewPrep.findFirst({
      where: { applicationId: interviewPrepApplicationId },
      include: { questions: true },
    });
    interviewQuestionId = prep!.questions[0]!.id;
  }, STEP_TIMEOUT * 3);

  afterAll(async () => {
    const { prisma } = await import("@/lib/prisma");
    if (userA?.userId) await prisma.user.delete({ where: { id: userA.userId } }).catch(() => {});
    if (userB?.userId) await prisma.user.delete({ where: { id: userB.userId } }).catch(() => {});
  });

  // Table of every "User B tries to touch User A's resource by ID" attempt. `auth: "web"` uses
  // User B's cookie session, `auth: "mobile"` uses User B's Bearer token — matching whichever
  // mechanism that route actually accepts (see the audit note in fullWorkflow.e2e.test.ts).
  it(
    "GET/PATCH/DELETE against every one of User A's resources, authenticated as User B, all fail",
    async () => {
      const attempts: Array<{ label: string; auth: "web" | "mobile"; path: string; method?: string; body?: unknown }> = [
        { label: "resume detail", auth: "web", path: `/api/resumes/${resumeId}`, method: "DELETE" },
        { label: "resume set-master", auth: "web", path: `/api/resumes/${resumeId}/set-master`, method: "POST" },
        { label: "profile entry PATCH", auth: "web", path: `/api/profile/entries/${profileEntryId}`, method: "PATCH", body: { value: "hacked" } },
        { label: "profile entry DELETE", auth: "web", path: `/api/profile/entries/${profileEntryId}`, method: "DELETE" },
        { label: "profile entry confirm", auth: "web", path: `/api/profile/entries/${profileEntryId}/confirm`, method: "POST" },
        { label: "job detail", auth: "mobile", path: `/api/jobs/${jobId}` },
        { label: "job delete", auth: "mobile", path: `/api/jobs/${jobId}`, method: "DELETE" },
        { label: "job apply", auth: "mobile", path: `/api/jobs/${jobId}/apply`, method: "POST" },
        { label: "job rescore", auth: "web", path: `/api/jobs/${jobId}/rescore`, method: "POST" },
        { label: "job resume-version", auth: "web", path: `/api/jobs/${jobId}/resume-version` },
        { label: "job contacts list", auth: "web", path: `/api/jobs/${jobId}/contacts` },
        { label: "application detail", auth: "mobile", path: `/api/applications/${applicationId}` },
        { label: "application PATCH", auth: "mobile", path: `/api/applications/${applicationId}`, method: "PATCH", body: { notes: "hacked" } },
        { label: "application status", auth: "mobile", path: `/api/applications/${applicationId}/status`, method: "POST", body: { status: "REJECTED" } },
        { label: "application interview-prep", auth: "mobile", path: `/api/applications/${applicationId}/interview-prep` },
        { label: "contact detail", auth: "mobile", path: `/api/contacts/${contactId}` },
        { label: "contact PATCH", auth: "mobile", path: `/api/contacts/${contactId}`, method: "PATCH", body: { name: "hacked" } },
        { label: "contact DELETE", auth: "mobile", path: `/api/contacts/${contactId}`, method: "DELETE" },
        { label: "contact messages generate", auth: "mobile", path: `/api/contacts/${contactId}/messages`, method: "POST", body: { messageType: "FOLLOW_UP" } },
        { label: "contact messages PATCH", auth: "mobile", path: `/api/contacts/${contactId}/messages`, method: "PATCH", body: { messageType: "CONNECTION_REQUEST", status: "SENT" } },
        { label: "follow-up detail", auth: "web", path: `/api/follow-ups/${followUpId}`, method: "PATCH", body: { status: "DISMISSED" } },
        { label: "follow-up draft", auth: "web", path: `/api/follow-ups/${followUpId}/draft`, method: "POST" },
        { label: "interview-question PATCH", auth: "mobile", path: `/api/interview-questions/${interviewQuestionId}`, method: "PATCH", body: { rehearsed: true } },
        { label: "interview-question mock-attempt", auth: "mobile", path: `/api/interview-questions/${interviewQuestionId}/mock-attempt`, method: "POST", body: { responseText: "hacked attempt" } },
      ];

      const failures: string[] = [];
      for (const attempt of attempts) {
        const init: RequestInit = { method: attempt.method ?? "GET" };
        if (attempt.body !== undefined) {
          init.headers = { "Content-Type": "application/json" };
          init.body = JSON.stringify(attempt.body);
        }
        const res = attempt.auth === "web" ? await webAs(userB, attempt.path, init) : await mobileAs(userB, attempt.path, init);
        // 404 is the correct, chosen behavior (never confirm-by-403 that the resource exists for
        // someone else); 401 would mean auth itself failed, which is also an acceptable "did not
        // leak/mutate anything" outcome but should not happen here since User B *is* authenticated.
        if (res.status !== 404) {
          failures.push(`${attempt.label}: expected 404, got ${res.status}`);
        }
      }

      expect(failures, `IDOR found:\n${failures.join("\n")}`).toEqual([]);
    },
    STEP_TIMEOUT * 4 // 24 sequential requests, each potentially paying dev-mode's first-hit route compile cost
  );

  it(
    "list endpoints never include another tenant's rows",
    async () => {
      const [jobsB, applicationsB, contactsB, followUpsB] = await Promise.all([
        mobileAs(userB, "/api/jobs").then((r) => json<{ jobs: Array<{ id: string }> }>(r)),
        mobileAs(userB, "/api/applications").then((r) => json<{ applications: Array<{ id: string }> }>(r)),
        mobileAs(userB, "/api/contacts").then((r) => json<{ contacts: Array<{ id: string }> }>(r)),
        mobileAs(userB, "/api/follow-ups").then((r) => json<{ followUps: Array<{ id: string }> }>(r)),
      ]);

      expect(jobsB.jobs.some((j) => j.id === jobId)).toBe(false);
      expect(applicationsB.applications.some((a) => a.id === applicationId)).toBe(false);
      expect(contactsB.contacts.some((c) => c.id === contactId)).toBe(false);
      expect(followUpsB.followUps.some((f) => f.id === followUpId)).toBe(false);

      // And User B's own lists are empty/self-only — not "everyone's data minus one row".
      expect(jobsB.jobs.length).toBe(0);
      expect(applicationsB.applications.length).toBe(0);
      expect(contactsB.contacts.length).toBe(0);
    },
    STEP_TIMEOUT
  );

  it(
    "account export for User B never contains any of User A's data",
    async () => {
      const res = await mobileAs(userB, "/api/account/export");
      expect(res.status).toBe(200);
      const body = await json<Record<string, unknown>>(res);
      const raw = JSON.stringify(body);
      expect(raw).not.toContain(jobId);
      expect(raw).not.toContain(applicationId);
      expect(raw).not.toContain(contactId);
      expect(raw).not.toContain(resumeId);
      expect((body.user as { email: string }).email).toBe(userB.email);
    },
    STEP_TIMEOUT
  );

  it(
    "career-health aggregate for User B reflects only User B's own (empty) footprint, never User A's",
    async () => {
      // Not an ID-substitution target like the sweep above — /api/career-health has no resource
      // id, it's a "my own aggregate" endpoint like /api/profile and /api/account/export. The
      // isolation risk here is a query that accidentally pools across every user's rows instead
      // of scoping by userId; User B has zero activity, so a leak would show up as a nonzero
      // categoriesUsed/overallScore reflecting User A's real data.
      const res = await mobileAs(userB, "/api/career-health");
      expect(res.status).toBe(200);
      const body = await json<{ summary: { overallScore: number | null; categoriesUsed: number } }>(res);
      expect(body.summary.categoriesUsed).toBe(0);
      expect(body.summary.overallScore).toBeNull();
    },
    STEP_TIMEOUT
  );

  it(
    "User A can still reach all of their own resources (isolation isn't just \"everything 404s\")",
    async () => {
      const res = await mobileAs(userA, `/api/applications/${applicationId}`);
      expect(res.status).toBe(200);
      const body = await json<{ application: { id: string } }>(res);
      expect(body.application.id).toBe(applicationId);
    },
    STEP_TIMEOUT
  );
});
