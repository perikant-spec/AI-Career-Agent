import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  checkUserAndGlobalRateLimit,
  getClientIp,
  __resetRateLimitStateForTests,
} from "@/lib/security/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStateForTests();
    vi.useRealTimers();
  });

  it("allows requests up to the max within the window", () => {
    const key = "test-key-1";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 60_000, 5).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds max, with a retryAfterSeconds", () => {
    const key = "test-key-2";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 60_000, 5);
    const result = checkRateLimit(key, 60_000, 5);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent — one key being blocked doesn't affect another", () => {
    const keyA = "test-key-a";
    const keyB = "test-key-b";
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 60_000, 5);
    expect(checkRateLimit(keyA, 60_000, 5).allowed).toBe(false);
    expect(checkRateLimit(keyB, 60_000, 5).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const key = "test-key-3";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 1000, 5);
    expect(checkRateLimit(key, 1000, 5).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, 1000, 5).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("checkUserAndGlobalRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStateForTests();
  });

  it("allows requests under both the per-user and global caps", () => {
    const result = checkUserAndGlobalRateLimit({
      scope: "test-scope-1",
      userId: "user-1",
      userMax: 5,
      userWindowMs: 60_000,
      globalMax: 100,
      globalWindowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks once the per-user cap is exceeded, even though global is nowhere near its cap", () => {
    const config = { scope: "test-scope-2", userId: "user-2", userMax: 3, userWindowMs: 60_000, globalMax: 1000, globalWindowMs: 60_000 };
    for (let i = 0; i < 3; i++) checkUserAndGlobalRateLimit(config);
    expect(checkUserAndGlobalRateLimit(config).allowed).toBe(false);
  });

  it("blocks once the global cap is exceeded, even for a user well under their own per-user cap", () => {
    const globalConfig = { scope: "test-scope-3", userMax: 1000, userWindowMs: 60_000, globalMax: 3, globalWindowMs: 60_000 };
    // Three different users each make one request — none individually near their own cap.
    checkUserAndGlobalRateLimit({ ...globalConfig, userId: "user-a" });
    checkUserAndGlobalRateLimit({ ...globalConfig, userId: "user-b" });
    checkUserAndGlobalRateLimit({ ...globalConfig, userId: "user-c" });
    // A fourth request from yet another user trips the shared global bucket.
    expect(checkUserAndGlobalRateLimit({ ...globalConfig, userId: "user-d" }).allowed).toBe(false);
  });

  it("different scopes never share a bucket", () => {
    const configA = { scope: "scope-a", userId: "same-user", userMax: 1, userWindowMs: 60_000, globalMax: 1000, globalWindowMs: 60_000 };
    const configB = { scope: "scope-b", userId: "same-user", userMax: 1, userWindowMs: 60_000, globalMax: 1000, globalWindowMs: 60_000 };
    expect(checkUserAndGlobalRateLimit(configA).allowed).toBe(true);
    expect(checkUserAndGlobalRateLimit(configA).allowed).toBe(false); // scope-a now exhausted for this user
    expect(checkUserAndGlobalRateLimit(configB).allowed).toBe(true); // scope-b is untouched
  });
});

describe("getClientIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    const req = new Request("http://localhost/x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost/x", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const req = new Request("http://localhost/x");
    expect(getClientIp(req)).toBe("unknown");
  });
});
