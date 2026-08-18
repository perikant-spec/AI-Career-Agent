import { describe, it, expect } from "vitest";
import {
  countNewJobs,
  countHighPriority,
  countFollowUpsDueToday,
  findWorthContacting,
  resolveUpcomingInterview,
  type HiringManagerCandidate,
  type InterviewCandidate,
} from "@/lib/briefing/subFacts";
import { zonedDayRangeUtc } from "@/lib/time";

describe("countNewJobs", () => {
  it("counts only match scores created since the cutoff", () => {
    const since = new Date("2026-08-16T00:00:00Z");
    const scores = [
      { createdAt: new Date("2026-08-15T23:00:00Z") }, // before cutoff
      { createdAt: new Date("2026-08-16T00:00:00Z") }, // exactly at cutoff -- inclusive
      { createdAt: new Date("2026-08-16T12:00:00Z") },
    ];
    expect(countNewJobs(scores, since)).toBe(2);
  });

  it("is 0 with no match scores", () => {
    expect(countNewJobs([], new Date())).toBe(0);
  });
});

describe("countHighPriority", () => {
  it("counts only APPLY_STRONG, not APPLY or lower tiers", () => {
    const scores = [
      { recommendationTier: "APPLY_STRONG" },
      { recommendationTier: "APPLY_STRONG" },
      { recommendationTier: "APPLY" },
      { recommendationTier: "DONT_APPLY" },
    ];
    expect(countHighPriority(scores)).toBe(2);
  });
});

describe("countFollowUpsDueToday", () => {
  it("counts only PENDING follow-ups whose dueDate falls in the given local-day range", () => {
    const range = zonedDayRangeUtc({ year: 2026, month: 8, day: 17 }, "America/Chicago");
    const followUps = [
      { status: "PENDING", dueDate: new Date(range.startUtc.getTime() + 60 * 60 * 1000) }, // 1h into the day
      { status: "PENDING", dueDate: new Date(range.startUtc.getTime() - 1) }, // just before the day starts
      { status: "PENDING", dueDate: range.endUtc }, // exactly at the exclusive end -- not counted
      { status: "COMPLETED", dueDate: new Date(range.startUtc.getTime() + 60 * 60 * 1000) }, // right time, wrong status
    ];
    expect(countFollowUpsDueToday(followUps, range)).toBe(1);
  });

  it("is 0 with no follow-ups", () => {
    const range = zonedDayRangeUtc({ year: 2026, month: 8, day: 17 }, "UTC");
    expect(countFollowUpsDueToday([], range)).toBe(0);
  });
});

describe("findWorthContacting", () => {
  const base: HiringManagerCandidate = { name: "Dana", company: "Globex", warmth: null, createdAt: new Date("2026-08-01"), hasSentOutreach: false };

  it("returns null when there are no candidates", () => {
    expect(findWorthContacting([])).toBeNull();
  });

  it("excludes anyone who already has sent outreach", () => {
    const candidates = [{ ...base, hasSentOutreach: true }];
    expect(findWorthContacting(candidates)).toBeNull();
  });

  it("picks the highest-warmth uncontacted candidate", () => {
    const candidates: HiringManagerCandidate[] = [
      { ...base, name: "Low warmth", warmth: 20 },
      { ...base, name: "High warmth", warmth: 80 },
      { ...base, name: "Already contacted", warmth: 100, hasSentOutreach: true },
    ];
    expect(findWorthContacting(candidates)).toEqual({ name: "High warmth", company: "Globex" });
  });

  it("treats null warmth as lower than any set warmth, breaking further ties by most recent", () => {
    const candidates: HiringManagerCandidate[] = [
      { ...base, name: "No warmth, older", warmth: null, createdAt: new Date("2026-08-01") },
      { ...base, name: "No warmth, newer", warmth: null, createdAt: new Date("2026-08-10") },
      { ...base, name: "Has warmth", warmth: 1 },
    ];
    expect(findWorthContacting(candidates)?.name).toBe("Has warmth");

    const noWarmthOnly: HiringManagerCandidate[] = [
      { ...base, name: "No warmth, older", warmth: null, createdAt: new Date("2026-08-01") },
      { ...base, name: "No warmth, newer", warmth: null, createdAt: new Date("2026-08-10") },
    ];
    expect(findWorthContacting(noWarmthOnly)?.name).toBe("No warmth, newer");
  });
});

describe("resolveUpcomingInterview", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  const base: InterviewCandidate = { status: "APPLIED", company: "Globex", title: "PM", scheduledAt: null };

  it("returns null when nothing is at interview stage", () => {
    expect(resolveUpcomingInterview([{ ...base, status: "APPLIED" }], now)).toBeNull();
  });

  it("returns hasTime:true with the soonest future scheduledAt among multiple interviews", () => {
    const candidates: InterviewCandidate[] = [
      { ...base, status: "INTERVIEW", company: "Later Co", scheduledAt: new Date("2026-08-20T15:00:00Z") },
      { ...base, status: "INTERVIEW", company: "Sooner Co", scheduledAt: new Date("2026-08-18T15:00:00Z") },
    ];
    const result = resolveUpcomingInterview(candidates, now);
    expect(result).toEqual({ hasTime: true, scheduledAtUtc: new Date("2026-08-18T15:00:00Z"), company: "Sooner Co", title: "PM" });
  });

  // The single highest-value test in this feature: never fabricate an interview time.
  it("returns hasTime:false with no time anywhere when at interview stage but scheduledAt is null", () => {
    const result = resolveUpcomingInterview([{ ...base, status: "INTERVIEW", company: "Globex", scheduledAt: null }], now);
    expect(result).toEqual({ hasTime: false, company: "Globex", title: "PM" });
    expect(result).not.toHaveProperty("scheduledAtUtc");
  });

  it("falls back to hasTime:false when the only scheduledAt on record is already in the past", () => {
    const result = resolveUpcomingInterview([{ ...base, status: "INTERVIEW", scheduledAt: new Date("2026-08-01T09:00:00Z") }], now);
    expect(result?.hasTime).toBe(false);
  });

  it("includes FINAL_INTERVIEW status, not just INTERVIEW", () => {
    const result = resolveUpcomingInterview(
      [{ ...base, status: "FINAL_INTERVIEW", scheduledAt: new Date("2026-08-18T15:00:00Z") }],
      now
    );
    expect(result?.hasTime).toBe(true);
  });
});
