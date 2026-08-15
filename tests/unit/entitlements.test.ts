import { describe, it, expect } from "vitest";
import { resolvePlan, checkJobCap, checkProFeature } from "@/lib/billing/entitlements";
import { FREE_JOB_IMPORT_CAP } from "@/lib/billing/plans";

describe("resolvePlan", () => {
  it("grants PRO only when plan is PRO and status is entitled", () => {
    expect(resolvePlan("PRO", "ACTIVE")).toBe("PRO");
    expect(resolvePlan("PRO", "TRIALING")).toBe("PRO");
  });

  it("falls back to FREE for a PRO plan with a non-entitled status", () => {
    expect(resolvePlan("PRO", "PAST_DUE")).toBe("FREE");
    expect(resolvePlan("PRO", "CANCELED")).toBe("FREE");
    expect(resolvePlan("PRO", "INCOMPLETE")).toBe("FREE");
  });

  it("is FREE regardless of status when plan is FREE", () => {
    expect(resolvePlan("FREE", "ACTIVE")).toBe("FREE");
  });
});

describe("checkJobCap", () => {
  it("never caps PRO", () => {
    const result = checkJobCap("PRO", 500, 1);
    expect(result.allowed).toBe(true);
    expect(result.cap).toBeNull();
  });

  it("allows FREE up to exactly the cap", () => {
    const result = checkJobCap("FREE", FREE_JOB_IMPORT_CAP - 1, 1);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(FREE_JOB_IMPORT_CAP - 1);
    expect(result.cap).toBe(FREE_JOB_IMPORT_CAP);
  });

  it("blocks FREE the moment the import would exceed the cap", () => {
    const result = checkJobCap("FREE", FREE_JOB_IMPORT_CAP, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/upgrade to pro/i);
  });

  it("blocks a bulk import that would cross the cap even if currently under it", () => {
    const result = checkJobCap("FREE", FREE_JOB_IMPORT_CAP - 1, 3);
    expect(result.allowed).toBe(false);
  });
});

describe("checkProFeature", () => {
  it("allows PRO", () => {
    expect(checkProFeature("PRO", "APPLICATION_PACKAGE").allowed).toBe(true);
  });

  it("blocks FREE with a feature-specific upgrade message", () => {
    const result = checkProFeature("FREE", "NETWORKING_OUTREACH");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Pro plan");
  });
});
