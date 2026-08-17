import { describe, it, expect } from "vitest";
import { buildBriefingNarrative } from "@/lib/briefing/narrative";
import type { BriefingFacts } from "@/lib/briefing/types";

const emptyFacts: BriefingFacts = {
  timezone: "UTC",
  newJobsCount: 0,
  highPriorityCount: 0,
  followUpsDueTodayCount: 0,
  worthContacting: null,
  upcomingInterview: null,
  recommendedAction: null,
};

describe("buildBriefingNarrative", () => {
  it("produces every clause when every fact is present, matching the product example's shape", () => {
    // now = 2026-08-17 10:00 AM America/Chicago (CDT, UTC-5); interview is the next calendar day
    // at 10:00 AM local -- exercises the "tomorrow" relative-day branch end to end.
    const now = new Date("2026-08-17T15:00:00Z");
    const facts: BriefingFacts = {
      timezone: "America/Chicago",
      newJobsCount: 8,
      highPriorityCount: 3,
      followUpsDueTodayCount: 2,
      worthContacting: { name: "Dana Reyes", company: "Acme" },
      upcomingInterview: { hasTime: true, scheduledAtUtc: new Date("2026-08-18T15:00:00Z"), company: "Acme", title: "PM" },
      recommendedAction: { title: "PM", company: "Acme", score: 94 },
    };

    const narrative = buildBriefingNarrative(facts, now);

    expect(narrative.pushTitle).toBe("Good morning");
    expect(narrative.cardLines).toEqual([
      "I found 8 new jobs that match your profile.",
      "3 are high priority.",
      "You have 2 follow-ups due today.",
      "Dana Reyes at Acme is worth reaching out to.",
      "You have an interview with Acme tomorrow at 10:00 AM.",
      "Recommended action: apply to Acme first — your match score is 94%.",
    ]);
    expect(narrative.pushBody).toContain("8 new jobs");
    expect(narrative.pushBody).toContain("Recommended action");
  });

  it("uses singular phrasing (including correct verb agreement) for count-of-one facts", () => {
    const facts: BriefingFacts = { ...emptyFacts, newJobsCount: 1, highPriorityCount: 1, followUpsDueTodayCount: 1 };
    const narrative = buildBriefingNarrative(facts);
    expect(narrative.cardLines).toEqual([
      "I found 1 new job that matches your profile.",
      "1 is high priority.",
      "You have 1 follow-up due today.",
    ]);
  });

  it("omits every clause whose fact is absent, rather than forcing empty/placeholder text", () => {
    const facts: BriefingFacts = { ...emptyFacts, newJobsCount: 5 };
    const narrative = buildBriefingNarrative(facts);
    expect(narrative.cardLines).toEqual(["I found 5 new jobs that match your profile."]);
  });

  it("falls back to an honest onboarding message when every fact is empty", () => {
    const narrative = buildBriefingNarrative(emptyFacts);
    expect(narrative.cardLines).toHaveLength(1);
    expect(narrative.cardLines[0].toLowerCase()).toContain("nothing new");
    expect(narrative.pushBody.toLowerCase()).toContain("nothing new");
  });

  // The single highest-value test in this feature: the narrative must be structurally incapable
  // of printing a fabricated interview time.
  it("never prints a clock time when the interview has no scheduledAt", () => {
    const facts: BriefingFacts = {
      ...emptyFacts,
      upcomingInterview: { hasTime: false, company: "Acme", title: "PM" },
    };
    const narrative = buildBriefingNarrative(facts);
    expect(narrative.cardLines).toEqual(["You have an upcoming interview with Acme."]);
    // No AM/PM clock-time pattern anywhere in the output.
    expect(narrative.pushBody).not.toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    expect(narrative.cardLines.join(" ")).not.toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it("describes an interview happening later today as 'today', not 'tomorrow'", () => {
    const now = new Date("2026-08-17T13:00:00Z"); // 8:00 AM America/Chicago (CDT)
    const facts: BriefingFacts = {
      ...emptyFacts,
      timezone: "America/Chicago",
      upcomingInterview: { hasTime: true, scheduledAtUtc: new Date("2026-08-17T15:00:00Z"), company: "Acme", title: "PM" }, // 10 AM same local day
    };
    const narrative = buildBriefingNarrative(facts, now);
    expect(narrative.cardLines[0]).toBe("You have an interview with Acme today at 10:00 AM.");
  });

  it("describes an interview more than a day out with a formatted date instead of a relative word", () => {
    const now = new Date("2026-08-17T15:00:00Z");
    const facts: BriefingFacts = {
      ...emptyFacts,
      timezone: "America/Chicago",
      upcomingInterview: { hasTime: true, scheduledAtUtc: new Date("2026-08-20T15:00:00Z"), company: "Acme", title: "PM" },
    };
    const narrative = buildBriefingNarrative(facts, now);
    expect(narrative.cardLines[0]).toBe("You have an interview with Acme on Aug 20 at 10:00 AM.");
  });
});
