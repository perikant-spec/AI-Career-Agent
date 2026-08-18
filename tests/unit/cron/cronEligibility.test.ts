import { describe, it, expect } from "vitest";
import { isEligibleForBriefing, MORNING_WINDOW_START_HOUR, MORNING_WINDOW_END_HOUR } from "@/lib/briefing/cronEligibility";

describe("isEligibleForBriefing", () => {
  it("is eligible inside the morning window when nothing was sent yet today", () => {
    expect(isEligibleForBriefing({ currentLocalHour: MORNING_WINDOW_START_HOUR, alreadySentToday: false })).toBe(true);
    expect(isEligibleForBriefing({ currentLocalHour: MORNING_WINDOW_END_HOUR - 1, alreadySentToday: false })).toBe(true);
  });

  it("is not eligible outside the morning window", () => {
    expect(isEligibleForBriefing({ currentLocalHour: MORNING_WINDOW_START_HOUR - 1, alreadySentToday: false })).toBe(false);
    expect(isEligibleForBriefing({ currentLocalHour: MORNING_WINDOW_END_HOUR, alreadySentToday: false })).toBe(false); // window end is exclusive
    expect(isEligibleForBriefing({ currentLocalHour: 0, alreadySentToday: false })).toBe(false);
    expect(isEligibleForBriefing({ currentLocalHour: 23, alreadySentToday: false })).toBe(false);
  });

  it("is never eligible once today's briefing was already sent, even inside the window", () => {
    expect(isEligibleForBriefing({ currentLocalHour: MORNING_WINDOW_START_HOUR, alreadySentToday: true })).toBe(false);
  });
});
