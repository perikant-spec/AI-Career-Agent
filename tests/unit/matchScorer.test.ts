import { describe, it, expect } from "vitest";
import {
  scoreSkills,
  scoreExperience,
  scoreSeniority,
  scoreIndustry,
  scoreLocation,
  scoreCompensation,
  scoreEducationCertification,
  scoreCareerTrajectory,
} from "@/lib/scoring/categoryScorers";
import { computeDisqualifiers } from "@/lib/scoring/disqualifiers";
import { deriveRecommendation } from "@/lib/scoring/tiers";
import { computeMatchScore } from "@/lib/scoring/scoreJob";
import type { ProfileSnapshot } from "@/lib/profile/profileSnapshot";
import type { JobRequirements } from "@/lib/ai/types";

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    requiredSkills: [],
    niceToHaveSkills: [],
    requiredCertifications: [],
    ...overrides,
  };
}

function profile(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    skills: [],
    certifications: [],
    experience: [],
    yearsExperience: 0,
    versionHash: "test",
    ...overrides,
  };
}

describe("scoreSkills", () => {
  it("weights required skills 80% and nice-to-have 20%", () => {
    const result = scoreSkills(
      [{ name: "SQL", confidence: "VERIFIED" }, { name: "Jira", confidence: "VERIFIED" }],
      job({ requiredSkills: ["SQL", "Roadmapping"], niceToHaveSkills: ["Jira"] })
    );
    // reqRatio 0.5*0.8 + niceRatio 1*0.2 = 0.6 -> 60
    expect(result.score).toBe(60);
    expect(result.confidence).toBe("VERIFIED");
    expect(result.facts.missingRequiredSkills).toEqual(["Roadmapping"]);
  });

  it("falls back to nice-to-have only, marked low confidence, when no required skills are listed", () => {
    const result = scoreSkills([{ name: "Excel", confidence: "VERIFIED" }], job({ niceToHaveSkills: ["Excel"] }));
    expect(result.score).toBe(100);
    expect(result.confidence).toBe("NOT_VERIFIED");
  });
});

describe("scoreExperience", () => {
  it("scales toward 100 as actual years approach the requirement", () => {
    const result = scoreExperience(profile({ yearsExperience: 3 }), job({ minYearsExperience: 6 }));
    expect(result.score).toBe(50);
  });

  it("caps at 100 for exceeding the requirement", () => {
    const result = scoreExperience(profile({ yearsExperience: 10 }), job({ minYearsExperience: 6 }));
    expect(result.score).toBe(100);
  });

  it("is neutral and low-confidence when the posting states no requirement", () => {
    const result = scoreExperience(profile({ yearsExperience: 10 }), job({}));
    expect(result.confidence).toBe("NOT_VERIFIED");
  });
});

describe("scoreSeniority", () => {
  it("penalizes 25 points per ordinal level of gap", () => {
    expect(scoreSeniority("SENIOR", "SENIOR").score).toBe(100);
    expect(scoreSeniority("SENIOR", "STAFF").score).toBe(75); // adjacent ordinal levels
    expect(scoreSeniority("JUNIOR", "DIRECTOR").score).toBeLessThanOrEqual(25);
  });

  it("is neutral when either side is unknown", () => {
    expect(scoreSeniority(undefined, "SENIOR").confidence).toBe("NOT_VERIFIED");
  });
});

describe("scoreIndustry", () => {
  it("is always neutral/low-confidence for the heuristic provider, never a fabricated number", () => {
    const result = scoreIndustry();
    expect(result.score).toBe(50);
    expect(result.confidence).toBe("NOT_VERIFIED");
  });
});

describe("scoreLocation", () => {
  it("scores fully remote postings 100 regardless of preferences", () => {
    expect(scoreLocation(job({ remotePolicy: "REMOTE" }), null).score).toBe(100);
  });

  it("matches an exact target location", () => {
    const result = scoreLocation(
      job({ locationText: "Austin, TX" }),
      { targetLocations: ["Austin, TX"] }
    );
    expect(result.score).toBe(100);
  });

  it("is neutral/low-confidence with no preference data", () => {
    const result = scoreLocation(job({ locationText: "Austin, TX" }), null);
    expect(result.confidence).toBe("NOT_VERIFIED");
  });
});

describe("scoreCompensation", () => {
  it("scores 100 when the job's minimum clears the floor", () => {
    const result = scoreCompensation(job({ salaryMin: 150000, salaryMax: 180000 }), { targetLocations: [], salaryFloor: 140000 });
    expect(result.score).toBe(100);
  });

  it("never disqualifies on missing compensation data — just neutral", () => {
    const result = scoreCompensation(job({}), { targetLocations: [] });
    expect(result.confidence).toBe("NOT_VERIFIED");
    expect(result.score).toBe(50);
  });
});

describe("scoreEducationCertification", () => {
  it("scores 100 with high confidence when nothing is required", () => {
    const result = scoreEducationCertification(profile(), job({}));
    expect(result.score).toBe(100);
    expect(result.confidence).toBe("VERIFIED");
  });

  it("proportionally scores missing required certifications", () => {
    const result = scoreEducationCertification(
      profile({ certifications: ["PMP"] }),
      job({ requiredCertifications: ["PMP", "Six Sigma"] })
    );
    expect(result.score).toBe(50);
    expect(result.facts.missingCertifications).toEqual(["Six Sigma"]);
  });
});

describe("scoreCareerTrajectory", () => {
  it("is always tagged SUPPORTED_INFERENCE — a derived judgment, never a fact", () => {
    const result = scoreCareerTrajectory("SENIOR", "DIRECTOR");
    expect(result.confidence).toBe("SUPPORTED_INFERENCE");
  });
});

describe("computeDisqualifiers", () => {
  it("flags a missing required certification", () => {
    const disqualifiers = computeDisqualifiers(
      profile({ certifications: [] }),
      job({ requiredCertifications: ["AWS Certified Solutions Architect"] }),
      null
    );
    expect(disqualifiers.some((d) => d.code === "MISSING_REQUIRED_CERTIFICATION")).toBe(true);
  });

  it("flags a work-authorization mismatch only when both sides have real signal", () => {
    const disqualifiers = computeDisqualifiers(
      profile(),
      job({ workAuthorizationRequirement: "No sponsorship" }),
      { targetLocations: [], workAuthorization: "I need visa sponsorship" }
    );
    expect(disqualifiers.some((d) => d.code === "WORK_AUTHORIZATION_MISMATCH")).toBe(true);
  });

  it("does not disqualify on work authorization when the user's side is unknown", () => {
    const disqualifiers = computeDisqualifiers(
      profile(),
      job({ workAuthorizationRequirement: "No sponsorship" }),
      null
    );
    expect(disqualifiers.some((d) => d.code === "WORK_AUTHORIZATION_MISMATCH")).toBe(false);
  });

  it("flags a seniority gap of 3+ ordinal levels in either direction", () => {
    const disqualifiers = computeDisqualifiers(
      profile({ seniority: "JUNIOR" }),
      job({ seniorityLevel: "DIRECTOR" }),
      null
    );
    expect(disqualifiers.some((d) => d.code === "SENIORITY_GAP_BEYOND_THRESHOLD")).toBe(true);
  });
});

describe("deriveRecommendation — tier boundaries", () => {
  it.each([
    [100, "APPLY_STRONG"],
    [85, "APPLY_STRONG"],
    [84, "APPLY"],
    [70, "APPLY"],
    [69, "APPLY_IF_INTERESTED"],
    [55, "APPLY_IF_INTERESTED"],
    [54, "LOW_PRIORITY"],
    [40, "LOW_PRIORITY"],
    [39, "DONT_APPLY"],
    [0, "DONT_APPLY"],
  ])("scores %i -> %s with no disqualifiers", (score, tier) => {
    expect(deriveRecommendation(score, [])).toBe(tier);
  });

  it("forces DONT_APPLY regardless of a high score when disqualified", () => {
    expect(deriveRecommendation(95, [{ code: "X", reason: "test" }])).toBe("DONT_APPLY");
  });
});

describe("computeMatchScore — end to end", () => {
  it("still computes and shows the numeric score even when disqualified", () => {
    const result = computeMatchScore(
      profile({ skills: [{ name: "SQL", confidence: "VERIFIED" }], yearsExperience: 8 }),
      job({ requiredSkills: ["SQL"], requiredCertifications: ["PMP"] }),
      null
    );
    expect(result.disqualifiers.length).toBeGreaterThan(0);
    expect(result.recommendationTier).toBe("DONT_APPLY");
    expect(result.overallScore).toBeGreaterThan(0); // "would have scored X" is still meaningful
  });

  it("produces a real weighted overall score in the ordinary case", () => {
    const result = computeMatchScore(
      profile({
        skills: [{ name: "SQL", confidence: "VERIFIED" }, { name: "Roadmapping", confidence: "VERIFIED" }],
        yearsExperience: 6,
        seniority: "SENIOR",
      }),
      job({ requiredSkills: ["SQL", "Roadmapping"], minYearsExperience: 5, seniorityLevel: "SENIOR", remotePolicy: "REMOTE" }),
      null
    );
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.disqualifiers).toHaveLength(0);
  });
});
