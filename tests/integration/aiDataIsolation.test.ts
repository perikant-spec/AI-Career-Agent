import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";
import { generateResumeVersion } from "@/lib/resume/generateResumeVersion";
import { ensureOutreachMessage } from "@/lib/networking/generateOutreachMessage";
import { ensureInterviewPrep } from "@/lib/interview/generateInterviewPrep";
import { ensureFollowUpDraft } from "@/lib/followups/generateFollowUpDraft";
import { scoreMockAttempt } from "@/lib/interview/scoreMockAttempt";

// Every function below is what actually assembles the prompt/context sent to the AI provider —
// this is a level below the route-handler IDOR sweep in tests/integration/tenantIsolation.test.ts.
// Proving isolation *here* means no future route (however it wires up auth) can accidentally
// hand one user's resume/job/contact/conversation data to another user's AI request, because the
// function that builds that request refuses to run against a record it doesn't own — not because
// the caller happened to check first.
//
// Also proves the live, content-level claim: two users hitting AI-invoking endpoints concurrently
// never see each other's data in the reply, matching the AsyncLocalStorage-isolation unit test in
// tests/unit/aiUsageTracking.test.ts but at the full request level instead of the token-usage
// side-channel alone.
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

const createdUserIds: string[] = [];

async function createTestUser(label: string): Promise<string> {
  const email = `ai-isolation-${label}-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash("irrelevant-password", 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  createdUserIds.push(user.id);
  return user.id;
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON (status ${res.status}), got: ${text.slice(0, 300)}`);
  }
}

async function createIdentityViaHttp(label: string): Promise<{ userId: string; cookie: string }> {
  const email = `ai-isolation-http-${label}-${randomUUID()}@example.com`;
  const password = "isolationTestPass123";

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, acceptedLegal: true }),
  });
  const { user } = await json<{ user: { id: string } }>(registerRes);
  const userId = user.id;
  createdUserIds.push(userId);

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await json<{ csrfToken: string }>(csrfRes);
  const csrfCookie = csrfRes.headers.get("set-cookie");

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie ?? "" },
    body: new URLSearchParams({ email, password, csrfToken, redirect: "false", json: "true" }),
    redirect: "manual",
  });
  const cookie = [csrfCookie, ...loginRes.headers.getSetCookie()]
    .filter(Boolean)
    .map((c) => c!.split(";")[0])
    .join("; ");

  return { userId, cookie };
}

afterAll(async () => {
  const ids = createdUserIds.filter(Boolean);
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("AI request functions refuse to run against another user's records", () => {
  it(
    "scoreJobForUser rejects a jobId belonging to a different user",
    async () => {
      const owner = await createTestUser("score-owner");
      const attacker = await createTestUser("score-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Senior Engineer at Acme.", title: "Senior Engineer", company: "Acme" },
      });

      await expect(scoreJobForUser(attacker, job.id)).rejects.toThrow();
    },
    STEP_TIMEOUT
  );

  it(
    "generateResumeVersion rejects a jobId belonging to a different user",
    async () => {
      const owner = await createTestUser("resume-owner");
      const attacker = await createTestUser("resume-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Staff Engineer at Globex.", title: "Staff Engineer", company: "Globex" },
      });

      await expect(generateResumeVersion(attacker, job.id)).rejects.toThrow();
    },
    STEP_TIMEOUT
  );

  it(
    "ensureOutreachMessage rejects a contactId belonging to a different user",
    async () => {
      const owner = await createTestUser("outreach-owner");
      const attacker = await createTestUser("outreach-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Recruiter role.", title: "Recruiter", company: "Initech" },
      });
      const contact = await prisma.contact.create({
        data: { userId: owner, jobId: job.id, name: "Jane Recruiter" },
      });

      await expect(ensureOutreachMessage(attacker, contact.id, "CONNECTION_REQUEST")).rejects.toThrow();
    },
    STEP_TIMEOUT
  );

  it(
    "ensureInterviewPrep rejects an applicationId belonging to a different user (even once prep already exists)",
    async () => {
      const owner = await createTestUser("prep-owner");
      const attacker = await createTestUser("prep-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Product Manager role.", title: "Product Manager", company: "Umbrella" },
      });
      const application = await prisma.application.create({ data: { userId: owner, jobId: job.id, status: "INTERVIEW" } });

      // Build prep as the real owner first — this is the case that mattered: a fast "already
      // exists" path must still refuse a different userId, not just the slow "doesn't exist yet"
      // path.
      const ownedPrepId = await ensureInterviewPrep(owner, application.id);
      expect(ownedPrepId).toBeTruthy();

      await expect(ensureInterviewPrep(attacker, application.id)).rejects.toThrow();
    },
    STEP_TIMEOUT
  );

  it(
    "ensureFollowUpDraft rejects a followUpId belonging to a different user",
    async () => {
      const owner = await createTestUser("followup-owner");
      const attacker = await createTestUser("followup-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Designer role.", title: "Designer", company: "Wayne Enterprises" },
      });
      const application = await prisma.application.create({ data: { userId: owner, jobId: job.id, status: "APPLIED", appliedAt: new Date() } });
      const followUp = await prisma.followUp.create({
        data: { userId: owner, applicationId: application.id, dueDate: new Date(Date.now() + 86400000) },
      });

      await expect(ensureFollowUpDraft(attacker, followUp.id, false)).rejects.toThrow();
    },
    STEP_TIMEOUT
  );

  it(
    "scoreMockAttempt rejects an interviewQuestionId belonging to a different user",
    async () => {
      const owner = await createTestUser("mock-owner");
      const attacker = await createTestUser("mock-attacker");
      const job = await prisma.job.create({
        data: { userId: owner, source: "MANUAL_PASTE", rawText: "Data Scientist role.", title: "Data Scientist", company: "Stark Industries" },
      });
      const application = await prisma.application.create({ data: { userId: owner, jobId: job.id, status: "INTERVIEW" } });
      const prepId = await ensureInterviewPrep(owner, application.id);
      const question = await prisma.interviewQuestion.findFirstOrThrow({ where: { interviewPrepId: prepId } });

      await expect(scoreMockAttempt(attacker, question.id, "My answer to this question.")).rejects.toThrow();
    },
    STEP_TIMEOUT
  );
});

describe("Concurrent AI-invoking requests from different users never cross-contaminate", () => {
  let serverUp = false;

  beforeAll(async () => {
    serverUp = await serverReachable();
  }, 10000);

  it(
    "two users' assistant chat replies each reflect only their own job data, even fired concurrently",
    async () => {
      if (!serverUp) {
        console.warn("Dev server not reachable at " + BASE_URL + " — skipping live concurrency check.");
        return;
      }

      const [userA, userB] = await Promise.all([createIdentityViaHttp("chatA"), createIdentityViaHttp("chatB")]);

      // Distinct, unmistakable fixtures so a leak in either direction is unambiguous in the reply
      // text or toolResults payload.
      const jobA = await prisma.job.create({
        data: {
          userId: userA.userId,
          source: "MANUAL_PASTE",
          rawText: "Quantum Cryptography Lead at Zeta Nebula Labs.",
          title: "Quantum Cryptography Lead",
          company: "Zeta Nebula Labs",
          parsedRequirements: JSON.stringify({ requiredSkills: ["quantum computing"], niceToHaveSkills: [], requiredCertifications: [] }),
        },
      });
      const jobB = await prisma.job.create({
        data: {
          userId: userB.userId,
          source: "MANUAL_PASTE",
          rawText: "Underwater Basket Weaving Instructor at Coral Reef Academy.",
          title: "Underwater Basket Weaving Instructor",
          company: "Coral Reef Academy",
          parsedRequirements: JSON.stringify({ requiredSkills: ["basket weaving"], niceToHaveSkills: [], requiredCertifications: [] }),
        },
      });
      await prisma.matchScore.create({
        data: {
          userId: userA.userId,
          jobId: jobA.id,
          overallScore: 80,
          categoryScores: "{}",
          strengths: "[]",
          gaps: "[]",
          risks: "[]",
          disqualifiers: "[]",
          recommendationTier: "APPLY",
          profileVersionHash: "test-hash",
        },
      });
      await prisma.matchScore.create({
        data: {
          userId: userB.userId,
          jobId: jobB.id,
          overallScore: 80,
          categoryScores: "{}",
          strengths: "[]",
          gaps: "[]",
          risks: "[]",
          disqualifiers: "[]",
          recommendationTier: "APPLY",
          profileVersionHash: "test-hash",
        },
      });

      const chat = (cookie: string) =>
        fetch(`${BASE_URL}/api/assistant/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ message: "What should I apply to today?" }),
        }).then((r) => json<{ toolResults: unknown; reply: string }>(r));

      // Fired concurrently on purpose — this is what would surface any shared/module-level state
      // (a cache keyed wrong, a request-scoped variable that isn't actually request-scoped).
      const [replyA, replyB] = await Promise.all([chat(userA.cookie), chat(userB.cookie)]);

      const payloadA = JSON.stringify(replyA.toolResults);
      const payloadB = JSON.stringify(replyB.toolResults);

      expect(payloadA).toContain("Zeta Nebula Labs");
      expect(payloadA).not.toContain("Coral Reef Academy");
      expect(payloadA).not.toContain("Underwater Basket Weaving");

      expect(payloadB).toContain("Coral Reef Academy");
      expect(payloadB).not.toContain("Zeta Nebula Labs");
      expect(payloadB).not.toContain("Quantum Cryptography");
    },
    STEP_TIMEOUT
  );
});
