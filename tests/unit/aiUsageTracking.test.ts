import { describe, it, expect } from "vitest";
import { withUsageTracking, recordUsage, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

describe("withUsageTracking / recordUsage", () => {
  it("collects nothing when the wrapped function records no usage", async () => {
    const { result, usage } = await withUsageTracking(async () => "no ai call here");
    expect(result).toBe("no ai call here");
    expect(usage).toEqual([]);
  });

  it("collects a single recordUsage call made inside the wrapped function", async () => {
    const { usage } = await withUsageTracking(async () => {
      recordUsage({ inputTokens: 100, outputTokens: 50, model: "claude-x" });
    });
    expect(usage).toEqual([{ inputTokens: 100, outputTokens: 50, model: "claude-x" }]);
  });

  it("collects multiple recordUsage calls in call order", async () => {
    const { usage } = await withUsageTracking(async () => {
      recordUsage({ inputTokens: 10, outputTokens: 5, model: "claude-x" });
      recordUsage({ inputTokens: 20, outputTokens: 8, model: "claude-x" });
    });
    expect(usage).toHaveLength(2);
    expect(usage[0].inputTokens).toBe(10);
    expect(usage[1].inputTokens).toBe(20);
  });

  it("recordUsage outside of any withUsageTracking scope is a silent no-op", () => {
    expect(() => recordUsage({ inputTokens: 1, outputTokens: 1, model: "claude-x" })).not.toThrow();
  });

  it("concurrent withUsageTracking calls never leak usage into each other's scope (AsyncLocalStorage isolation)", async () => {
    async function trackedCall(label: string, delayMs: number) {
      return withUsageTracking(async () => {
        await new Promise((r) => setTimeout(r, delayMs));
        recordUsage({ inputTokens: 1, outputTokens: 1, model: label });
      });
    }

    const [a, b] = await Promise.all([trackedCall("A", 20), trackedCall("B", 5)]);
    expect(a.usage).toEqual([{ inputTokens: 1, outputTokens: 1, model: "A" }]);
    expect(b.usage).toEqual([{ inputTokens: 1, outputTokens: 1, model: "B" }]);
  });

  it("propagates a thrown error from the wrapped function instead of swallowing it", async () => {
    await expect(
      withUsageTracking(async () => {
        recordUsage({ inputTokens: 5, outputTokens: 5, model: "claude-x" });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});

describe("summarizeUsage", () => {
  it("returns all-null when there are no recorded calls", () => {
    expect(summarizeUsage([])).toEqual({ model: null, inputTokens: null, outputTokens: null });
  });

  it("sums tokens across multiple calls and uses the last call's model", () => {
    const summary = summarizeUsage([
      { inputTokens: 100, outputTokens: 50, model: "claude-x" },
      { inputTokens: 30, outputTokens: 10, model: "claude-y" },
    ]);
    expect(summary).toEqual({ model: "claude-y", inputTokens: 130, outputTokens: 60 });
  });
});

describe("estimateCostUsd", () => {
  it("returns null when any input is null (no AI call was actually made)", () => {
    expect(estimateCostUsd(null, 100, 50)).toBeNull();
    expect(estimateCostUsd("claude-x", null, 50)).toBeNull();
    expect(estimateCostUsd("claude-x", 100, null)).toBeNull();
  });

  it("computes a positive cost for a known token count", () => {
    const cost = estimateCostUsd("claude-x", 1_000_000, 1_000_000);
    expect(cost).not.toBeNull();
    expect(cost).toBeGreaterThan(0);
  });

  it("more tokens never produces a cheaper estimate", () => {
    const small = estimateCostUsd("claude-x", 1000, 1000)!;
    const large = estimateCostUsd("claude-x", 10000, 10000)!;
    expect(large).toBeGreaterThan(small);
  });

  it("falls back to the default price for an unrecognized model name rather than throwing", () => {
    expect(() => estimateCostUsd("some-future-model-not-in-the-table", 1000, 1000)).not.toThrow();
    expect(estimateCostUsd("some-future-model-not-in-the-table", 1000, 1000)).toBeGreaterThan(0);
  });

  it("zero tokens costs zero", () => {
    expect(estimateCostUsd("claude-x", 0, 0)).toBe(0);
  });
});
