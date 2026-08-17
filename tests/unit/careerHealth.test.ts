import { describe, it, expect } from "vitest";
import {
  computeConfidenceScore,
  scoreJobTargeting,
  scoreResumeQuality,
  scoreApplications,
  scoreNetworking,
  scoreFollowUps,
  scoreInterviewPrep,
} from "@/lib/health/subScorers";
import { selectOpportunity, type CategoryWithResult } from "@/lib/health/opportunity";
import { HEALTH_WEIGHTS } from "@/lib/health/weights";

describe("computeConfidenceScore / scoreResumeQuality", () => {
  it("is 0 with no profile entries", () => {
    expect(computeConfidenceScore([])).toBe(0);
    expect(scoreResumeQuality([]).sampleSize).toBe(0);
  });

  it("weights VERIFIED=1, SUPPORTED_INFERENCE=0.6, NOT_VERIFIED=0.3, MISSING=0", () => {
    // (1 + 0.6 + 0.3 + 0) / 4 = 0.475 -> 48
    const entries = [
      { confidence: "VERIFIED" as const },
      { confidence: "SUPPORTED_INFERENCE" as const },
      { confidence: "NOT_VERIFIED" as const },
      { confidence: "MISSING" as const },
    ];
    expect(computeConfidenceScore(entries)).toBe(48);
  });

  it("scoreResumeQuality reports unverifiedPercent as everything short of VERIFIED", () => {
    const result = scoreResumeQuality([
      { confidence: "VERIFIED" }, { confidence: "VERIFIED" }, { confidence: "SUPPORTED_INFERENCE" }, { confidence: "NOT_VERIFIED" },
    ]);
    expect(result.facts.unverifiedPercent).toBe(50); // 2 of 4 are not VERIFIED
    expect(result.sampleSize).toBe(4);
  });
});

describe("scoreJobTargeting", () => {
  it("is 0 sampleSize with no scored jobs, regardless of preferences", () => {
    const result = scoreJobTargeting([], { targetTitles: ["PM"], targetLocations: null, salaryFloor: null });
    expect(result.sampleSize).toBe(0);
    expect(result.score).toBe(0);
  });

  it("blends avg match score (85%) with preferences completeness (15%)", () => {
    // avgMatchScore = 80, preferencesCompleteness = 2/3 -> 67 -> 80*0.85 + 67*0.15 = 68 + 10.05 = 78.05 -> 78
    const result = scoreJobTargeting([70, 90], { targetTitles: ["PM"], targetLocations: ["Remote"], salaryFloor: null });
    expect(result.facts.avgMatchScore).toBe(80);
    expect(result.facts.preferencesCompleteness).toBe(67);
    expect(result.score).toBe(78);
    expect(result.sampleSize).toBe(2);
  });

  it("treats null preferences as 0% complete", () => {
    const result = scoreJobTargeting([100], null);
    expect(result.facts.preferencesCompleteness).toBe(0);
    expect(result.score).toBe(85); // 100*0.85 + 0*0.15
  });
});

describe("scoreApplications", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  const recent = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  it("is 0 sampleSize with no applied applications", () => {
    const result = scoreApplications([{ status: "DISCOVERED", appliedAt: null }], now);
    expect(result.sampleSize).toBe(0);
  });

  it("is volume-only below the progression sample threshold (< 3 applied)", () => {
    const apps = [
      { status: "APPLIED" as const, appliedAt: recent(5) },
      { status: "RECRUITER_CONTACT" as const, appliedAt: recent(10) },
    ];
    const result = scoreApplications(apps, now);
    expect(result.facts.progressionRate).toBeNull();
    // recentApplied=2, volumeScore = round(2/8*100) = 25
    expect(result.score).toBe(25);
    expect(result.sampleSize).toBe(2);
  });

  it("blends volume and progression 50/50 at or above the sample threshold", () => {
    const apps = [
      { status: "APPLIED" as const, appliedAt: recent(5) },
      { status: "RECRUITER_CONTACT" as const, appliedAt: recent(10) },
      { status: "APPLIED" as const, appliedAt: recent(15) },
      { status: "REJECTED" as const, appliedAt: recent(60) }, // outside 30-day volume window
    ];
    const result = scoreApplications(apps, now);
    // recentApplied=3 (60-day-old one excluded), volumeScore=round(3/8*100)=38
    // progressed=1 of 4 -> progressionRate=25
    // score = round(38*0.5 + 25*0.5) = round(31.5) = 32
    expect(result.facts.recentApplied).toBe(3);
    expect(result.facts.progressionRate).toBe(25);
    expect(result.score).toBe(32);
    expect(result.sampleSize).toBe(4);
  });

  it("caps volume score at 100 above the per-30-day target", () => {
    const apps = Array.from({ length: 12 }, () => ({ status: "APPLIED" as const, appliedAt: recent(1) }));
    const result = scoreApplications(apps, now);
    expect(result.facts.progressionRate).toBe(0); // none progressed
    // volumeScore capped at 100 -> score = round(100*0.5 + 0*0.5) = 50
    expect(result.score).toBe(50);
  });
});

describe("scoreNetworking", () => {
  it("is 0 sampleSize with no actively-pursued jobs", () => {
    expect(scoreNetworking([]).sampleSize).toBe(0);
  });

  it("is the fraction of active jobs with any sent outreach", () => {
    const result = scoreNetworking([
      { hasSentOutreach: true },
      { hasSentOutreach: false },
      { hasSentOutreach: false },
      { hasSentOutreach: false },
    ]);
    expect(result.score).toBe(25);
    expect(result.sampleSize).toBe(4);
    expect(result.facts.outreachCount).toBe(1);
  });
});

describe("scoreFollowUps", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  const past = new Date("2026-08-01T00:00:00Z");
  const future = new Date("2026-09-01T00:00:00Z");

  it("is 0 sampleSize with no follow-ups", () => {
    expect(scoreFollowUps([], now).sampleSize).toBe(0);
  });

  it("counts only PENDING + past-due as overdue — COMPLETED/DISMISSED/not-yet-due are on track", () => {
    const followUps = [
      { status: "PENDING" as const, dueDate: past }, // overdue
      { status: "PENDING" as const, dueDate: future }, // not yet due -> on track
      { status: "COMPLETED" as const, dueDate: past }, // on track
      { status: "DISMISSED" as const, dueDate: past }, // on track
    ];
    const result = scoreFollowUps(followUps, now);
    expect(result.facts.overdueCount).toBe(1);
    expect(result.score).toBe(75); // 3 of 4 on track
    expect(result.sampleSize).toBe(4);
  });
});

describe("scoreInterviewPrep", () => {
  it("is 0 sampleSize with no interview questions", () => {
    expect(scoreInterviewPrep([]).sampleSize).toBe(0);
  });

  it("is the rehearsed fraction across every question", () => {
    const result = scoreInterviewPrep([{ rehearsed: true }, { rehearsed: true }, { rehearsed: false }, { rehearsed: false }]);
    expect(result.score).toBe(50);
    expect(result.sampleSize).toBe(4);
  });
});

describe("HEALTH_WEIGHTS", () => {
  it("sums to 1", () => {
    const total = Object.values(HEALTH_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("selectOpportunity", () => {
  function categories(overrides: Partial<Record<CategoryWithResult["key"], CategoryWithResult["result"]>> = {}): CategoryWithResult[] {
    const defaultResult = { score: 80, sampleSize: 5, facts: {} };
    return (
      [
        "jobTargeting",
        "resumeQuality",
        "applications",
        "networking",
        "followUps",
        "interviewPrep",
      ] as const
    ).map((key) => ({ key, result: overrides[key] ?? { ...defaultResult } }));
  }

  it("returns an onboarding insight when fewer than 2 categories have data", () => {
    const result = selectOpportunity(
      categories({
        jobTargeting: { score: 80, sampleSize: 3, facts: {} },
        resumeQuality: { score: 0, sampleSize: 0, facts: {} },
        applications: { score: 0, sampleSize: 0, facts: {} },
        networking: { score: 0, sampleSize: 0, facts: {} },
        followUps: { score: 0, sampleSize: 0, facts: {} },
        interviewPrep: { score: 0, sampleSize: 0, facts: {} },
      }),
      80
    );
    expect(result.kind).toBe("onboarding");
    expect(result.categoryKey).toBeNull();
  });

  it("returns a positive insight when every populated category is good and the composite is strong", () => {
    const result = selectOpportunity(categories(), 90);
    expect(result.kind).toBe("positive");
  });

  it("does not return positive when populated categories are good but the composite itself is below the strong threshold", () => {
    const result = selectOpportunity(categories(), 80);
    expect(result.kind).toBe("opportunity");
  });

  it("picks the single lowest-scoring populated category and fills its template from its own facts", () => {
    const result = selectOpportunity(
      categories({
        networking: {
          score: 20,
          sampleSize: 4,
          facts: { activeJobCount: 4, outreachCount: 1 },
        },
      }),
      70
    );
    expect(result.kind).toBe("opportunity");
    expect(result.categoryKey).toBe("networking");
    expect(result.headline).toMatch(/networking/i);
    expect(result.detail).toContain("1"); // outreachCount
    expect(result.detail).toContain("4"); // activeJobCount
  });

  it("ignores unpopulated categories even if their nominal score would be lowest", () => {
    const result = selectOpportunity(
      categories({
        followUps: { score: 0, sampleSize: 0, facts: {} }, // no data — must not be picked
        networking: { score: 30, sampleSize: 3, facts: { activeJobCount: 3, outreachCount: 1 } },
      }),
      70
    );
    expect(result.categoryKey).toBe("networking");
  });

  it("breaks ties by HEALTH_CATEGORIES declaration order (jobTargeting before applications)", () => {
    const result = selectOpportunity(
      categories({
        jobTargeting: { score: 40, sampleSize: 5, facts: { avgMatchScore: 40, preferencesCompleteness: 0 } },
        applications: { score: 40, sampleSize: 5, facts: { recentApplied: 1 } },
      }),
      60
    );
    expect(result.categoryKey).toBe("jobTargeting");
  });
});
