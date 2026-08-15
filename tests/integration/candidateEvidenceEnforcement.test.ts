import "dotenv/config";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Proves the anti-hallucination system is *enforceable*, not just "the real providers happen to
// behave" — by substituting a provider that deliberately fabricates a claim (a metric and a
// skill that appear nowhere in the candidate's actual profile) and asserting the generation
// pipeline rejects it: the persisted resume keeps its deterministic original content, the AI
// interaction is recorded as ERROR, and the fabricated text never reaches storage. Every real
// AIProvider implementation (mock, Anthropic) is trusted no further than this stand-in is —
// citing a valid entity id is not sufficient on its own, per lib/evidence/claimValidator.ts.
const fakeProvider = {
  name: "fake-hallucinating",
  version: "test-1.0",
  generateResumeCustomization: vi.fn(),
  generateCoverLetter: vi.fn(),
  generateApplicationAnswers: vi.fn(),
  extractResumeEntities: vi.fn(),
  extractJobRequirements: vi.fn(),
  generateRationale: vi.fn(),
  generateAssistantReply: vi.fn(),
  generateOutreachMessage: vi.fn(),
  generateFollowUpMessage: vi.fn(),
  scoreMockInterviewResponse: vi.fn(),
};

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => fakeProvider,
}));

const createdUserIds: string[] = [];

async function createTestUser(): Promise<string> {
  const email = `evidence-enforce-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash("irrelevant-password", 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  createdUserIds.push(user.id);
  return user.id;
}

afterAll(async () => {
  const ids = createdUserIds.filter(Boolean);
  if (ids.length > 0) await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Candidate evidence validation is enforced, not merely advisory", () => {
  it("generateResumeVersion rejects a fabricated summary and keeps the deterministic original", async () => {
    const userId = await createTestUser();
    const summaryText = "Backend engineer focused on reliability.";
    await prisma.careerProfileEntry.create({
      data: {
        userId,
        section: "SUMMARY",
        value: summaryText,
        confidence: "VERIFIED",
        orderIndex: 0,
      },
    });
    const bulletText = "Maintained internal services with a small team.";
    await prisma.careerProfileEntry.create({
      data: {
        userId,
        section: "EXPERIENCE",
        value: "Backend Engineer",
        label: "Backend Engineer",
        structuredData: JSON.stringify({ bullets: [bulletText] }),
        confidence: "VERIFIED",
        orderIndex: 1,
      },
    });
    const job = await prisma.job.create({
      data: {
        userId,
        source: "MANUAL_PASTE",
        rawText: "Backend Engineer role.",
        title: "Backend Engineer",
        company: "Acme",
        // Required skill deliberately overlaps the bullet's own wording so the deterministic
        // customizer (lib/resume/customize.ts) actually selects a topRelevantBullet — that's
        // what makes generateResumeCustomization get called at all.
        parsedRequirements: JSON.stringify({ requiredSkills: ["internal services"], niceToHaveSkills: [], requiredCertifications: [] }),
      },
    });

    // The citation id is real (so validateCitations alone would pass) — the fabrication is a
    // metric and a skill invented out of thin air, not anywhere in the candidate's real data.
    fakeProvider.generateResumeCustomization.mockImplementation(async (request: { citedEntities: Array<{ id: string }> }) => ({
      tailoredSummary: "Improved system uptime by 400% using Kubernetes and led a 20-person team.",
      citedEntityIds: request.citedEntities.map((e) => e.id),
    }));

    const { generateResumeVersion } = await import("@/lib/resume/generateResumeVersion");
    const result = await generateResumeVersion(userId, job.id);

    expect(fakeProvider.generateResumeCustomization).toHaveBeenCalled();
    // Fabrication rejected — the fallback is the real, unmodified original summary.
    expect(result.content.summary.tailored).toBe(result.content.summary.original);
    expect(result.content.summary.tailored).not.toContain("400%");
    expect(result.content.summary.tailored).not.toContain("Kubernetes");

    // The rejection is also visible in the audit trail, not silently swallowed.
    const interaction = await prisma.aIInteraction.findFirst({
      where: { userId, toolName: "resume.customize" },
      orderBy: { createdAt: "desc" },
    });
    expect(interaction?.status).toBe("ERROR");

    // And the persisted row on disk matches what was returned — no fabricated text sneaks in
    // via a separate write path.
    const saved = await prisma.resumeVersion.findUniqueOrThrow({ where: { userId_jobId: { userId, jobId: job.id } } });
    const savedContent = JSON.parse(saved.content);
    expect(savedContent.summary.tailored).not.toContain("400%");
  });

  it("a grounded, non-fabricated summary from the same call path is accepted", async () => {
    const userId = await createTestUser();
    const summaryText = "Backend engineer focused on reliability.";
    await prisma.careerProfileEntry.create({
      data: { userId, section: "SUMMARY", value: summaryText, confidence: "VERIFIED", orderIndex: 0 },
    });
    const bulletText = "Maintained internal services with a small team.";
    await prisma.careerProfileEntry.create({
      data: {
        userId,
        section: "EXPERIENCE",
        value: "Backend Engineer",
        label: "Backend Engineer",
        structuredData: JSON.stringify({ bullets: [bulletText] }),
        confidence: "VERIFIED",
        orderIndex: 1,
      },
    });
    const job = await prisma.job.create({
      data: {
        userId,
        source: "MANUAL_PASTE",
        rawText: "Backend Engineer role.",
        title: "Backend Engineer",
        company: "Acme",
        parsedRequirements: JSON.stringify({ requiredSkills: ["internal services"], niceToHaveSkills: [], requiredCertifications: [] }),
      },
    });

    fakeProvider.generateResumeCustomization.mockImplementation(
      async (request: { citedEntities: Array<{ id: string }>; masterSummary?: string; topRelevantPhrase?: string }) => ({
        tailoredSummary: `${request.masterSummary} — directly relevant: ${request.topRelevantPhrase}`,
        citedEntityIds: request.citedEntities.map((e) => e.id),
      })
    );

    const { generateResumeVersion } = await import("@/lib/resume/generateResumeVersion");
    const result = await generateResumeVersion(userId, job.id);

    // A real, grounded rephrasing is not falsely rejected — this proves the validator isn't
    // just rejecting everything.
    expect(result.content.summary.tailored).not.toBe(result.content.summary.original);
    expect(result.content.summary.tailored).toContain(summaryText);

    const interaction = await prisma.aIInteraction.findFirst({
      where: { userId, toolName: "resume.customize" },
      orderBy: { createdAt: "desc" },
    });
    expect(interaction?.status).toBe("SUCCESS");
  });
});
