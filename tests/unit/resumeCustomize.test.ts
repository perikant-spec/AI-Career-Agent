import { describe, it, expect } from "vitest";
import { buildDeterministicCustomization } from "@/lib/resume/customize";
import { computeAtsScore } from "@/lib/resume/atsScore";
import type { JobRequirements } from "@/lib/ai/types";

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [], ...overrides };
}

// Minimal fake CareerProfileEntry rows — only the fields customize.ts reads.
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

describe("buildDeterministicCustomization — skills", () => {
  it("promotes required and nice-to-have matches to the front, in that order", () => {
    const entries = [
      entry({ section: "SKILL", value: "Excel" }),
      entry({ section: "SKILL", value: "SQL" }),
      entry({ section: "SKILL", value: "Jira" }),
    ];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["SQL"], niceToHaveSkills: ["Jira"] }));
    expect(result.skills.map((s) => s.value)).toEqual(["SQL", "Jira", "Excel"]);
    expect(result.skills[0].tag).toBe("matched-required");
    expect(result.skills[1].tag).toBe("matched-nice");
  });

  it("only logs a REORDERED change when the order actually changed", () => {
    const entries = [entry({ section: "SKILL", value: "SQL" }), entry({ section: "SKILL", value: "Excel" })];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["SQL"] }));
    expect(result.changeLog.some((c) => c.kind === "REORDERED")).toBe(false); // SQL was already first
  });

  it("ignores NOT_VERIFIED/MISSING skills entirely", () => {
    const entries = [entry({ section: "SKILL", value: "SQL", confidence: "NOT_VERIFIED" })];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["SQL"] }));
    expect(result.skills).toHaveLength(0);
  });
});

describe("buildDeterministicCustomization — experience bullets", () => {
  it("reorders bullets within a role by keyword relevance", () => {
    const entries = [
      entry({
        section: "EXPERIENCE",
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Wrote internal docs", "Owned the SQL-driven roadmap"],
        }),
      }),
    ];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["SQL", "roadmap"] }));
    expect(result.experience[0].bullets[0].originalText).toBe("Owned the SQL-driven roadmap");
    expect(result.experience[0].bullets[0].emphasized).toBe(true);
    expect(result.changeLog.some((c) => c.kind === "EMPHASIZED")).toBe(true);
  });

  it("picks the single most relevant bullet as topRelevantBullet", () => {
    const entries = [
      entry({
        section: "EXPERIENCE",
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Owned SQL roadmap and stakeholder management", "Wrote docs"],
        }),
      }),
    ];
    const result = buildDeterministicCustomization(
      entries,
      job({ requiredSkills: ["SQL", "roadmap", "stakeholder management"] })
    );
    expect(result.topRelevantBullet?.text).toContain("Owned SQL roadmap");
  });

  it("applies a curated term adaptation and logs it, without touching unrelated text", () => {
    const entries = [
      entry({
        section: "EXPERIENCE",
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Managed the customer support handoff"],
        }),
      }),
    ];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["client success"] }));
    expect(result.experience[0].bullets[0].text).toContain("client success");
    expect(result.experience[0].bullets[0].adapted).toBe(true);
    expect(result.changeLog.some((c) => c.kind === "TERM_ADAPTED")).toBe(true);
  });

  it("does not list a term-adapted requirement as left out — the tailored text now covers it", () => {
    const entries = [
      entry({
        section: "EXPERIENCE",
        structuredData: JSON.stringify({
          title: "PM",
          company: "Acme",
          bullets: ["Managed the customer support handoff"],
        }),
      }),
    ];
    const result = buildDeterministicCustomization(entries, job({ requiredSkills: ["client success"] }));
    expect(result.leftOut).not.toContain("client success");
  });
});

describe("buildDeterministicCustomization — left out on purpose", () => {
  it("flags required skills/certs with no trace in the profile, never fabricating them", () => {
    const entries = [entry({ section: "SKILL", value: "SQL" })];
    const result = buildDeterministicCustomization(
      entries,
      job({ requiredSkills: ["SQL", "Kubernetes"], requiredCertifications: ["AWS Certified Solutions Architect"] })
    );
    expect(result.leftOut).toContain("Kubernetes");
    expect(result.leftOut).toContain("AWS Certified Solutions Architect");
    expect(result.leftOut).not.toContain("SQL");
  });
});

describe("computeAtsScore", () => {
  it("scores required skills in the top window at full weight", () => {
    const score = computeAtsScore(["SQL", "Roadmapping"], "", job({ requiredSkills: ["SQL", "Roadmapping"] }));
    expect(score).toBe(100);
  });

  it("scores a keyword only present in bullet text lower than an exact skill", () => {
    const inSkills = computeAtsScore(["SQL"], "", job({ requiredSkills: ["SQL"] }));
    const inBulletsOnly = computeAtsScore([], "worked with SQL daily", job({ requiredSkills: ["SQL"] }));
    expect(inBulletsOnly).toBeLessThan(inSkills);
    expect(inBulletsOnly).toBeGreaterThan(0);
  });

  it("scores 0 contribution for a keyword missing entirely", () => {
    const score = computeAtsScore(["SQL"], "", job({ requiredSkills: ["SQL", "Kubernetes"] }));
    expect(score).toBe(50); // 1 of 2 keywords at full weight
  });

  it("is neutral when the job has no keywords to score against", () => {
    expect(computeAtsScore(["SQL"], "", job({}))).toBe(50);
  });
});
