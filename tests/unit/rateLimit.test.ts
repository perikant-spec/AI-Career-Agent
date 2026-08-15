import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, getClientIp, __resetRateLimitStateForTests } from "@/lib/security/rateLimit";

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
