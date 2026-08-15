import { describe, it, expect } from "vitest";
import { extractJobRequirementsHeuristic } from "@/lib/ai/providers/mock/jobExtraction";

const RICH_POSTING = `
Group Product Manager

Globex is hiring a Group Product Manager to own our activation roadmap.

Location: Remote (US)
Salary: $150,000 - $180,000

Required:
- 6+ years of product management experience
- Strong SQL and stakeholder management skills
- Experience with roadmapping and A/B testing

Preferred:
- Familiarity with Jira and experimentation platforms

This is a senior role reporting to the VP of Product. No visa sponsorship is available for
this position.
`;

const SPARSE_POSTING = "PM needed. Remote. Apply now.";

describe("extractJobRequirementsHeuristic — rich posting", () => {
  const result = extractJobRequirementsHeuristic(RICH_POSTING);

  it("extracts the title and company", () => {
    expect(result.title).toBe("Group Product Manager");
    expect(result.company).toBe("Globex");
  });

  it("extracts required and nice-to-have skills separately", () => {
    expect(result.parsedRequirements.requiredSkills).toContain("SQL");
    expect(result.parsedRequirements.requiredSkills).toContain("Stakeholder management");
    expect(result.parsedRequirements.niceToHaveSkills).toContain("Jira");
  });

  it("extracts years of experience and seniority", () => {
    expect(result.parsedRequirements.minYearsExperience).toBe(6);
    expect(result.parsedRequirements.seniorityLevel).toBe("SENIOR");
  });

  it("extracts a salary range", () => {
    expect(result.parsedRequirements.salaryMin).toBe(150000);
    expect(result.parsedRequirements.salaryMax).toBe(180000);
  });

  it("detects remote policy and work authorization constraint", () => {
    expect(result.parsedRequirements.remotePolicy).toBe("REMOTE");
    expect(result.parsedRequirements.workAuthorizationRequirement).toMatch(/sponsorship/i);
  });

  it("reports high confidence for a detailed posting", () => {
    expect(result.extractionConfidence).toBe("VERIFIED");
    expect(result.warnings).toHaveLength(0);
  });
});

describe("extractJobRequirementsHeuristic — sparse posting", () => {
  const result = extractJobRequirementsHeuristic(SPARSE_POSTING);

  it("forces low confidence instead of a falsely precise read", () => {
    expect(result.extractionConfidence).toBe("NOT_VERIFIED");
    expect(result.warnings.some((w) => /short on detail/i.test(w))).toBe(true);
  });
});
