import { describe, it, expect } from "vitest";
import { computeFollowUpDueDate, isDue, daysBetween } from "@/lib/followups/dueDate";
import { generateFollowUpMessageHeuristic } from "@/lib/ai/providers/mock/followUpMessage";
import type { FollowUpMessageRequest } from "@/lib/ai/types";

describe("computeFollowUpDueDate", () => {
  it("adds the configured number of days to the anchor", () => {
    const anchor = new Date("2026-08-01T00:00:00.000Z");
    const due = computeFollowUpDueDate(anchor, 7);
    expect(due.toISOString()).toBe("2026-08-08T00:00:00.000Z");
  });

  it("respects a custom day count, not a hardcoded 7", () => {
    const anchor = new Date("2026-08-01T00:00:00.000Z");
    const due = computeFollowUpDueDate(anchor, 3);
    expect(due.toISOString()).toBe("2026-08-04T00:00:00.000Z");
  });
});

describe("isDue", () => {
  it("is true when the due date has passed", () => {
    expect(isDue(new Date("2026-08-01"), new Date("2026-08-05"))).toBe(true);
  });

  it("is true exactly at the due date", () => {
    const t = new Date("2026-08-05T12:00:00.000Z");
    expect(isDue(t, t)).toBe(true);
  });

  it("is false before the due date", () => {
    expect(isDue(new Date("2026-08-10"), new Date("2026-08-05"))).toBe(false);
  });
});

describe("daysBetween", () => {
  it("computes whole days elapsed", () => {
    expect(daysBetween(new Date("2026-08-01"), new Date("2026-08-08"))).toBe(7);
  });
});

describe("generateFollowUpMessageHeuristic", () => {
  function request(overrides: Partial<FollowUpMessageRequest> = {}): FollowUpMessageRequest {
    return {
      jobTitle: "Group Product Manager",
      companyName: "Globex",
      topMatchedSkills: ["SQL", "Roadmapping"],
      topRelevantPhrase: "Owned the activation roadmap across three squads.",
      citedEntities: [{ id: "e1", label: "Acme bullet", value: "Owned the activation roadmap" }],
      daysSinceApplied: 7,
      ...overrides,
    };
  }

  it("states the actual days-since-applied fact", () => {
    const result = generateFollowUpMessageHeuristic(request({ daysSinceApplied: 12 }));
    expect(result.content).toContain("12 days ago");
  });

  it("never speculates about why there's been no response", () => {
    const result = generateFollowUpMessageHeuristic(request());
    expect(result.content).not.toMatch(/busy|high volume|process|hiring team is/i);
  });

  it("passes through only the offered citations", () => {
    const result = generateFollowUpMessageHeuristic(request());
    expect(result.citedEntityIds).toEqual(["e1"]);
  });

  it("degrades gracefully with no matched skills or relevant phrase", () => {
    const result = generateFollowUpMessageHeuristic(
      request({ topMatchedSkills: [], topRelevantPhrase: undefined, citedEntities: [] })
    );
    expect(result.content).toContain("Globex");
    expect(result.citedEntityIds).toEqual([]);
  });

  it("uses singular 'day' for exactly one day", () => {
    const result = generateFollowUpMessageHeuristic(request({ daysSinceApplied: 1 }));
    expect(result.content).toContain("1 day ago");
    expect(result.content).not.toContain("1 days ago");
  });
});
