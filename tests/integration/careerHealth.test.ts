import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { createWebSession } from "./helpers/webSession";

// Proves the real DB wiring in lib/health/computeCareerHealth.ts — the relation names/field
// names used in its Prisma queries (Application -> job -> contacts -> messages,
// InterviewQuestion -> interviewPrep -> userId, etc.) actually match the schema when run against
// real Postgres, not just the pure-function math already covered by
// tests/unit/careerHealth.test.ts. Builds one real user's footprint across all six domains via
// the same real HTTP flow tests/integration/fullWorkflow.e2e.test.ts uses.
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

This is a senior role. No visa sponsorship is available for this position.`;

describe.runIf(await serverReachable())("Career Search Health — real DB wiring", () => {
  const email = `e2e-health-${Date.now()}@example.com`;
  const password = "e2eTestPass123";
  let cookie: string;
  let token: string;
  let userId: string;

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

    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Health Test", acceptedLegal: true }),
    });
    expect(registerRes.status).toBe(201);
    userId = (await json<{ user: { id: string } }>(registerRes)).user.id;

    cookie = await createWebSession(BASE_URL, email, password);
    const loginRes = await fetch(`${BASE_URL}/api/mobile/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    token = (await json<{ token: string }>(loginRes)).token;

    const { prisma } = await import("@/lib/prisma");
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: "PRO", status: "ACTIVE" },
      update: { plan: "PRO", status: "ACTIVE" },
    });

    // Job targeting + resume quality: real resume upload + preferences.
    const fileBytes = await readFile(path.resolve(__dirname, "..", "fixtures", "resumes", "sample-resume.pdf"));
    const form = new FormData();
    form.append("file", new Blob([fileBytes], { type: "application/pdf" }), "resume.pdf");
    const uploadRes = await web("/api/resumes", { method: "POST", body: form });
    expect(uploadRes.status).toBe(200);

    await web("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTitles: ["Product Manager"], targetLocations: ["Remote"], salaryFloor: 140000 }),
    });

    // Applications + progression: one job applied and progressed past a bare Applied.
    const jobRes = await mobile("/api/jobs", { method: "POST", body: JSON.stringify({ rawText: SAMPLE_JOB_TEXT }) });
    const jobId = (await json<{ job: { id: string } }>(jobRes)).job.id;
    const applyRes = await mobile(`/api/jobs/${jobId}/apply`, { method: "POST" });
    const applicationId = (await json<{ applicationId: string }>(applyRes)).applicationId;
    await mobile(`/api/applications/${applicationId}/status`, { method: "POST", body: JSON.stringify({ status: "APPLIED" }) });
    await mobile(`/api/applications/${applicationId}/status`, { method: "POST", body: JSON.stringify({ status: "RECRUITER_CONTACT" }) });

    // Networking: a contact on that job with a message actually marked SENT.
    const contactRes = await web(`/api/jobs/${jobId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dana Reyes", contactType: "HIRING_MANAGER" }),
    });
    const contactId = (await json<{ contact: { id: string } }>(contactRes)).contact.id;
    await mobile(`/api/contacts/${contactId}/messages`, { method: "POST", body: JSON.stringify({ messageType: "CONNECTION_REQUEST" }) });
    await mobile(`/api/contacts/${contactId}/messages`, {
      method: "PATCH",
      body: JSON.stringify({ messageType: "CONNECTION_REQUEST", status: "SENT" }),
    });

    // Follow-ups: auto-scheduled the moment status became APPLIED, above.

    // Interview prep: advance to INTERVIEW, then mark one question rehearsed.
    await mobile(`/api/applications/${applicationId}/status`, { method: "POST", body: JSON.stringify({ status: "INTERVIEW" }) });
    const prep = await prisma.interviewPrep.findFirstOrThrow({ where: { applicationId }, include: { questions: true } });
    await mobile(`/api/interview-questions/${prep.questions[0]!.id}`, { method: "PATCH", body: JSON.stringify({ rehearsed: true }) });
  }, STEP_TIMEOUT * 3);

  afterAll(async () => {
    if (!userId) return;
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it(
    "returns a fully-populated summary with real values wired from every domain",
    async () => {
      const res = await mobile("/api/career-health");
      expect(res.status).toBe(200);
      const body = await json<{
        summary: {
          overallScore: number | null;
          categoriesUsed: number;
          categories: Array<{ key: string; label: string; score: number; sampleSize: number }>;
          opportunity: { kind: string; headline: string; detail: string };
        };
      }>(res);
      const { summary } = body;

      // All six domains were touched above, so every category should have real data — this is
      // the DB-wiring proof the pure-function tests can't provide (they never touch Prisma).
      expect(summary.categoriesUsed).toBe(6);
      expect(summary.categories).toHaveLength(6);
      for (const category of summary.categories) {
        expect(category.sampleSize, `${category.key} should have real data`).toBeGreaterThan(0);
        expect(category.score).toBeGreaterThanOrEqual(0);
        expect(category.score).toBeLessThanOrEqual(100);
      }

      expect(summary.overallScore).not.toBeNull();
      expect(summary.overallScore!).toBeGreaterThanOrEqual(0);
      expect(summary.overallScore!).toBeLessThanOrEqual(100);

      // Networking: exactly one active job, with sent outreach -> should score 100.
      const networking = summary.categories.find((c) => c.key === "networking")!;
      expect(networking.sampleSize).toBe(1);
      expect(networking.score).toBe(100);

      // Interview prep: exactly one of several questions marked rehearsed -> a partial score,
      // never 0 or 100 (proves the rehearsed flag actually reached the aggregate, not just that
      // some default value was returned).
      const interviewPrep = summary.categories.find((c) => c.key === "interviewPrep")!;
      expect(interviewPrep.score).toBeGreaterThan(0);
      expect(interviewPrep.score).toBeLessThan(100);

      expect(["opportunity", "positive", "onboarding"]).toContain(summary.opportunity.kind);
      expect(summary.opportunity.headline.length).toBeGreaterThan(0);
    },
    STEP_TIMEOUT
  );
});
