import { describe, it, expect } from "vitest";
import { bucketFunnel, countClosedOut } from "@/lib/analytics/funnel";

describe("bucketFunnel", () => {
  it("groups statuses into the 5 funnel stages by current status", () => {
    const statuses = ["DISCOVERED", "DISCOVERED", "SHORTLISTED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER"];
    const funnel = bucketFunnel(statuses);
    expect(funnel.find((f) => f.key === "discovered")?.count).toBe(2);
    expect(funnel.find((f) => f.key === "shortlisted")?.count).toBe(1);
    expect(funnel.find((f) => f.key === "applied")?.count).toBe(2); // APPLIED + SCREENING
    expect(funnel.find((f) => f.key === "interview")?.count).toBe(1);
    expect(funnel.find((f) => f.key === "offer")?.count).toBe(1);
  });

  it("excludes REJECTED/WITHDRAWN from every funnel bucket", () => {
    const funnel = bucketFunnel(["REJECTED", "WITHDRAWN"]);
    expect(funnel.every((f) => f.count === 0)).toBe(true);
  });

  it("returns all 5 stages even when empty, never omitting a bucket", () => {
    const funnel = bucketFunnel([]);
    expect(funnel).toHaveLength(5);
    expect(funnel.every((f) => f.count === 0)).toBe(true);
  });
});

describe("countClosedOut", () => {
  it("counts only REJECTED and WITHDRAWN", () => {
    expect(countClosedOut(["REJECTED", "WITHDRAWN", "APPLIED", "OFFER"])).toBe(2);
  });

  it("returns 0 when nothing is closed out", () => {
    expect(countClosedOut(["DISCOVERED", "APPLIED"])).toBe(0);
  });
});
