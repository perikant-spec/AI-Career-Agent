import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractResumeEntitiesHeuristic } from "@/lib/ai/providers/mock/resumeExtraction";

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "..", "fixtures", "resumes", name), "utf-8");
}

describe("extractResumeEntitiesHeuristic — normal resume", () => {
  const result = extractResumeEntitiesHeuristic(fixture("normal.txt"));

  it("extracts a verified summary with a real source span", () => {
    const summary = result.entries.find((e) => e.section === "SUMMARY");
    expect(summary).toBeDefined();
    expect(summary?.confidence).toBe("VERIFIED");
    expect(summary?.sourceSpan).toBeDefined();
    expect(summary?.value).toContain("Product manager with 6 years");
  });

  it("matches known skills as VERIFIED with a span pointing at real text", () => {
    const sql = result.entries.find((e) => e.section === "SKILL" && e.label === "SQL");
    expect(sql).toBeDefined();
    expect(sql?.confidence).toBe("VERIFIED");
    expect(sql?.sourceSpan?.text.toLowerCase()).toBe("sql");
  });

  it("parses both experience entries with title/company/dates", () => {
    interface ExperienceStructuredData {
      title: string;
      company: string;
      bullets: string[];
    }
    const experience = result.entries.filter((e) => e.section === "EXPERIENCE");
    expect(experience).toHaveLength(2);
    const acme = experience.find(
      (e) => (e.structuredData as ExperienceStructuredData | undefined)?.company === "Acme Inc."
    );
    expect(acme).toBeDefined();
    const structured = acme?.structuredData as unknown as ExperienceStructuredData;
    expect(structured.title).toBe("Senior Product Manager");
    expect(structured.bullets.length).toBeGreaterThan(0);
  });

  it("infers team leadership as SUPPORTED_INFERENCE, never VERIFIED", () => {
    const leadership = result.entries.find((e) => e.label === "Team leadership");
    expect(leadership).toBeDefined();
    expect(leadership?.confidence).toBe("SUPPORTED_INFERENCE");
    expect(leadership?.basisText).toMatch(/managed 2 direct reports/i);
  });

  it("extracts achievements with quantified metrics", () => {
    const achievements = result.entries.filter((e) => e.section === "ACHIEVEMENT");
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements.some((a) => /18%/.test(a.value))).toBe(true);
  });

  it("extracts education and a certification", () => {
    const education = result.entries.find((e) => e.section === "EDUCATION" && e.value !== "");
    expect(education?.confidence).toBe("VERIFIED");
    const cert = result.entries.find((e) => e.section === "CERTIFICATION");
    expect(cert?.label).toBe("Certified Scrum Master");
  });

  it("reports no conflicts for non-overlapping roles", () => {
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("extractResumeEntitiesHeuristic — overlapping dates", () => {
  const result = extractResumeEntitiesHeuristic(fixture("overlapping-dates.txt"));

  it("flags overlapping employment as a conflict instead of silently picking one", () => {
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].description).toMatch(/overlap/i);
  });
});

describe("extractResumeEntitiesHeuristic — missing summary", () => {
  const result = extractResumeEntitiesHeuristic(fixture("missing-summary.txt"));

  it("marks summary as MISSING rather than fabricating one", () => {
    const summary = result.entries.find((e) => e.section === "SUMMARY");
    expect(summary?.confidence).toBe("MISSING");
    expect(summary?.value).toBe("");
  });

  it("still extracts skills and experience from the rest of the document", () => {
    expect(result.entries.some((e) => e.section === "SKILL" && e.label === "SQL")).toBe(true);
    expect(result.entries.some((e) => e.section === "EXPERIENCE")).toBe(true);
  });
});

describe("extractResumeEntitiesHeuristic — oddly formatted / no headers", () => {
  const result = extractResumeEntitiesHeuristic(fixture("oddly-formatted.txt"));

  it("still finds some matchable skills without crashing", () => {
    const skills = result.entries.filter((e) => e.section === "SKILL");
    expect(skills.some((s) => s.label === "Social media marketing")).toBe(true);
  });

  it("emits a warning about missing section structure", () => {
    expect(result.warnings.some((w) => /section headers/i.test(w))).toBe(true);
  });
});
