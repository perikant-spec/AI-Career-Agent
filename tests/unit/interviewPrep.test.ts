import { describe, it, expect } from "vitest";
import { extractCompanyResearch } from "@/lib/interview/companyResearch";
import { rankExperienceBullets, buildStarAnswer } from "@/lib/interview/starAnswers";
import { scoreMockInterviewResponseHeuristic } from "@/lib/ai/providers/mock/mockInterviewScore";
import type { JobRequirements } from "@/lib/ai/types";

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [], ...overrides };
}

function entry(overrides: Record<string, unknown>) {
  return {
    id: "id-" + Math.random().toString(36).slice(2),
    userId: "u1",
    sourceDocumentId: null,
    section: "EXPERIENCE",
    label: null,
    value: "",
    structuredData: null,
    confidence: "VERIFIED",
    basisText: null,
    sourceSpanStart: null,
    sourceSpanEnd: null,
    sourceSpanText: null,
    orderIndex: 0,
    userConfirmed: false,
    userEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}

describe("extractCompanyResearch", () => {
  it("extracts sentences matching known patterns, never fabricating facts", () => {
    const text = "We are hiring a PM. Our mission is to make onboarding delightful. The team reports to the VP of Product. We use a modern React and Node stack.";
    const result = extractCompanyResearch(text);
    expect(result.some((s) => s.label === "Mission & values")).toBe(true);
    expect(result.some((s) => s.label === "Tech & tools")).toBe(true);
    result.forEach((s) => expect(text).toContain(s.text));
  });

  it("returns an empty array rather than guessing when nothing matches", () => {
    const result = extractCompanyResearch("Short posting with no matching content at all here.");
    expect(result).toEqual([]);
  });
});

describe("rankExperienceBullets", () => {
  it("ranks bullets by job-keyword overlap, most relevant first", () => {
    const entries = [
      entry({
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Wrote internal docs", "Owned the SQL-driven roadmap for three squads"],
        }),
      }),
    ];
    const ranked = rankExperienceBullets(entries, job({ requiredSkills: ["SQL", "roadmap"] }));
    expect(ranked[0].text).toContain("Owned the SQL-driven roadmap");
  });

  it("excludes NOT_VERIFIED/MISSING entries", () => {
    const entries = [
      entry({
        confidence: "NOT_VERIFIED",
        structuredData: JSON.stringify({ title: "PM", company: "Acme", bullets: ["Did something with SQL"] }),
      }),
    ];
    const ranked = rankExperienceBullets(entries, job({ requiredSkills: ["SQL"] }));
    expect(ranked).toHaveLength(0);
  });
});

describe("buildStarAnswer", () => {
  it("builds Situation from verified company/title/dates and leaves Task null rather than inventing one", () => {
    const star = buildStarAnswer({
      entryId: "e1",
      company: "Acme",
      title: "Senior PM",
      startDate: "2021",
      endDate: "Present",
      text: "Owned the activation roadmap across three squads.",
      matchCount: 2,
    });
    expect(star.situation).toContain("Senior PM at Acme");
    expect(star.situation).toContain("2021");
    expect(star.task).toBeNull();
    expect(star.citedEntityIds).toEqual(["e1"]);
  });

  it("splits out a Result only when the bullet contains an extractable metric", () => {
    const star = buildStarAnswer({
      entryId: "e1",
      company: "Acme",
      title: "PM",
      text: "Ran onboarding experiments that lifted activation 18%.",
      matchCount: 1,
    });
    expect(star.result).toContain("18%");
    expect(star.action).not.toContain("18%");
  });

  it("also recognizes a spelled-out metric like '18 percent', not just the '%' symbol", () => {
    const star = buildStarAnswer({
      entryId: "e1",
      company: "Acme",
      title: "PM",
      text: "Ran onboarding experiments that lifted activation 18 percent.",
      matchCount: 1,
    });
    expect(star.result).toContain("18 percent");
    expect(star.action).not.toContain("18 percent");
  });

  it("leaves Result null when there's no metric, never fabricating one", () => {
    const star = buildStarAnswer({
      entryId: "e1",
      company: "Acme",
      title: "PM",
      text: "Managed the customer support handoff.",
      matchCount: 0,
    });
    expect(star.result).toBeNull();
    expect(star.action).toBe("Managed the customer support handoff.");
  });

  it("returns all-null fields when no bullet is available, rather than inventing an example", () => {
    const star = buildStarAnswer(undefined);
    expect(star.situation).toBeNull();
    expect(star.action).toBeNull();
    expect(star.citedEntityIds).toEqual([]);
  });
});

describe("scoreMockInterviewResponseHeuristic", () => {
  it("scores a short, thin answer lower on completeness than a fuller one", () => {
    const short = scoreMockInterviewResponseHeuristic({ question: "Tell me about a challenge.", responseText: "It was hard." });
    const long = scoreMockInterviewResponseHeuristic({
      question: "Tell me about a challenge.",
      responseText:
        "At my last role we faced a major challenge when a key integration broke in production. First I triaged the issue with the on-call engineer, then I coordinated a fix, and as a result we restored service within two hours and documented a runbook so it wouldn't happen again.",
    });
    expect(long.scoreCompleteness).toBeGreaterThan(short.scoreCompleteness);
  });

  it("scores higher relevance when the response shares keywords with the question", () => {
    const relevant = scoreMockInterviewResponseHeuristic({
      question: "Tell me about your experience with SQL and roadmapping.",
      responseText: "My SQL and roadmapping experience comes from leading three product launches.",
    });
    const irrelevant = scoreMockInterviewResponseHeuristic({
      question: "Tell me about your experience with SQL and roadmapping.",
      responseText: "I enjoy hiking and painting on weekends.",
    });
    expect(relevant.scoreRelevance).toBeGreaterThan(irrelevant.scoreRelevance);
  });

  it("never claims anything about the candidate beyond the response text (feedback stays generic)", () => {
    const result = scoreMockInterviewResponseHeuristic({ question: "Tell me about a time you led a team.", responseText: "I led a team of five engineers." });
    expect(result.feedback).not.toMatch(/you (are|were) (a|an) (great|bad|excellent)/i);
  });
});
