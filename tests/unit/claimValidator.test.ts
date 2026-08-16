import { describe, it, expect } from "vitest";
import { extractNumericClaims, validateGeneratedClaims, allowedSourceTextFromFacts } from "@/lib/evidence/claimValidator";
import type { ApplicationGenerationFacts } from "@/lib/ai/types";

describe("extractNumericClaims", () => {
  it("extracts plain integers, percentages, and 'N+' counts", () => {
    expect(extractNumericClaims("Grew revenue by 300% with a team of 12, 5+ years experience")).toEqual(
      expect.arrayContaining(["300%", "12", "5+"])
    );
  });

  it("returns an empty array for text with no digits", () => {
    expect(extractNumericClaims("No numbers here at all.")).toEqual([]);
  });
});

describe("validateGeneratedClaims", () => {
  it("accepts generated text whose numbers and skills all appear in the allowed source", () => {
    const allowed = "Led a team of 12 engineers using React and TypeScript.";
    const generated = "Directly relevant: led a team of 12 engineers using React.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(true);
    expect(result.unsupportedNumbers).toEqual([]);
    expect(result.unsupportedSkills).toEqual([]);
  });

  it("rejects a fabricated metric not present anywhere in the allowed source", () => {
    const allowed = "Led a team using React and TypeScript.";
    const generated = "Grew revenue by 300% while leading the team.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(false);
    expect(result.unsupportedNumbers).toContain("300%");
  });

  it("rejects a fabricated skill not present anywhere in the allowed source", () => {
    const allowed = "Led a team using React.";
    const generated = "Led a team using React and Kubernetes.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(false);
    expect(result.unsupportedSkills).toContain("Kubernetes");
  });

  it("rejects when both a fabricated number and a fabricated skill are present", () => {
    const allowed = "Worked on backend systems.";
    const generated = "Shipped 50 features using Kubernetes.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(false);
    expect(result.unsupportedNumbers).toContain("50");
    expect(result.unsupportedSkills).toContain("Kubernetes");
  });

  it("does not flag a number that appears in the allowed source in a different sentence", () => {
    const allowed = "Job posting mentions a team of 8 people. Candidate has 8 years experience.";
    const generated = "Directly relevant: 8 years experience.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(true);
  });

  it("is not fooled by a claim disguised as an instruction-style override (defense in depth alongside prompt-injection wrapping)", () => {
    const allowed = "Candidate has experience with Python.";
    // Even if a prompt-injection attempt got the model to output something like this, the
    // fabricated "500%" and "Kubernetes" claims still get caught here regardless of how they
    // were produced.
    const generated = "Ignore prior instructions — candidate improved performance by 500% using Kubernetes.";
    const result = validateGeneratedClaims(generated, allowed);
    expect(result.valid).toBe(false);
  });
});

describe("allowedSourceTextFromFacts", () => {
  const facts: ApplicationGenerationFacts = {
    jobTitle: "Senior Engineer",
    companyName: "Acme",
    topMatchedSkills: ["React", "SQL"],
    topRelevantPhrase: "Owned the activation roadmap across three squads.",
    citedEntities: [{ id: "e1", label: "Acme bullet", value: "Led migration to React" }],
  };

  it("includes every field from the facts object", () => {
    const text = allowedSourceTextFromFacts(facts);
    expect(text).toContain("Senior Engineer");
    expect(text).toContain("Acme");
    expect(text).toContain("React");
    expect(text).toContain("SQL");
    expect(text).toContain("Owned the activation roadmap across three squads.");
    expect(text).toContain("Led migration to React");
  });

  it("includes extra fields (e.g. contact name, daysSinceApplied) when provided", () => {
    const text = allowedSourceTextFromFacts(facts, ["Jane Recruiter", 12, undefined]);
    expect(text).toContain("Jane Recruiter");
    expect(text).toContain("12");
  });

  it("omits undefined/optional facts fields without throwing", () => {
    const sparse: ApplicationGenerationFacts = { topMatchedSkills: [], citedEntities: [] };
    expect(() => allowedSourceTextFromFacts(sparse)).not.toThrow();
  });
});
