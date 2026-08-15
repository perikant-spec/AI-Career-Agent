import { describe, it, expect } from "vitest";
import { generateCoverLetterHeuristic } from "@/lib/ai/providers/mock/coverLetter";
import { generateApplicationAnswersHeuristic } from "@/lib/ai/providers/mock/applicationAnswers";
import { buildApplicationFacts } from "@/lib/application/facts";
import { DEFAULT_APPLICATION_QUESTIONS } from "@/lib/application/questions";
import type { JobRequirements, ApplicationGenerationFacts } from "@/lib/ai/types";

function facts(overrides: Partial<ApplicationGenerationFacts> = {}): ApplicationGenerationFacts {
  return {
    jobTitle: "Group Product Manager",
    companyName: "Globex",
    topMatchedSkills: ["SQL", "Roadmapping"],
    topRelevantPhrase: "Owned the activation roadmap across three squads.",
    citedEntities: [{ id: "e1", label: "Acme bullet", value: "Owned the activation roadmap" }],
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown>) {
  return {
    id: "id-" + Math.random().toString(36).slice(2),
    userId: "u1",
    sourceDocumentId: null,
    section: "SKILL",
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

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [], ...overrides };
}

describe("generateCoverLetterHeuristic", () => {
  it("only references topMatchedSkills/topRelevantPhrase/jobTitle/companyName — never fabricates", () => {
    const result = generateCoverLetterHeuristic(facts());
    expect(result.content).toContain("Globex");
    expect(result.content).toContain("Group Product Manager");
    expect(result.content).toContain("SQL");
    expect(result.content).toContain("Roadmapping");
    expect(result.content).toContain("Owned the activation roadmap across three squads");
  });

  it("passes through exactly the offered citedEntities, nothing more", () => {
    const result = generateCoverLetterHeuristic(facts());
    expect(result.citedEntityIds).toEqual(["e1"]);
  });

  it("degrades gracefully with no matched skills or relevant phrase", () => {
    const result = generateCoverLetterHeuristic(
      facts({ topMatchedSkills: [], topRelevantPhrase: undefined, citedEntities: [] })
    );
    expect(result.content).toContain("Globex");
    expect(result.citedEntityIds).toEqual([]);
  });
});

describe("generateApplicationAnswersHeuristic", () => {
  it("returns exactly one answer per question, in order", () => {
    const result = generateApplicationAnswersHeuristic({ ...facts(), questions: [...DEFAULT_APPLICATION_QUESTIONS] });
    expect(result.answers).toHaveLength(DEFAULT_APPLICATION_QUESTIONS.length);
    expect(result.answers.map((a) => a.question)).toEqual(DEFAULT_APPLICATION_QUESTIONS);
  });

  it("grounds the 'strength' answer in the top matched skill only", () => {
    const result = generateApplicationAnswersHeuristic({
      ...facts(),
      questions: ["What is your greatest strength for this role?"],
    });
    expect(result.answers[0].answer).toContain("SQL");
  });

  it("grounds the 'experience' answer in the verified relevant phrase", () => {
    const result = generateApplicationAnswersHeuristic({
      ...facts(),
      questions: ["What relevant experience do you bring to this position?"],
    });
    expect(result.answers[0].answer).toBe("Owned the activation roadmap across three squads.");
  });
});

describe("buildApplicationFacts", () => {
  it("reuses the resume customizer's deterministic selection to pick topMatchedSkills/topRelevantPhrase", () => {
    const entries = [
      entry({ section: "SKILL", value: "SQL" }),
      entry({ section: "SKILL", value: "Excel" }),
      entry({
        section: "EXPERIENCE",
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Owned SQL roadmap work", "Wrote internal docs"],
        }),
      }),
    ];
    const result = buildApplicationFacts(entries, job({ requiredSkills: ["SQL"] }), "PM", "Acme");
    expect(result.topMatchedSkills).toEqual(["SQL"]);
    expect(result.topRelevantPhrase).toContain("Owned SQL roadmap");
    expect(result.citedEntities).toHaveLength(1);
  });

  it("never fabricates a citedEntity when nothing is relevant", () => {
    const entries = [entry({ section: "SKILL", value: "Excel" })];
    const result = buildApplicationFacts(entries, job({ requiredSkills: ["Kubernetes"] }), null, null);
    expect(result.citedEntities).toHaveLength(0);
    expect(result.topRelevantPhrase).toBeUndefined();
  });
});
