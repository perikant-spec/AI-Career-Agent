import "dotenv/config";
import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAIBudget } from "@/lib/ai/usageLimits";

// Proves the AI cost cap is actually enforced against real spend recorded in Postgres, not just
// that the pure math in lib/ai/pricing.ts is correct. Requires a running Postgres reachable via
// DATABASE_URL (see scripts/postgres-local.mjs — `npm run db:start`), same convention as the
// other tests/integration specs.
const createdUserIds: string[] = [];

async function createTestUser(): Promise<string> {
  const email = `ai-cost-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash("irrelevant-password", 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  createdUserIds.push(user.id);
  return user.id;
}

async function recordSpend(userId: string, costUsd: number, createdAt: Date = new Date()) {
  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "test.spend",
      provider: "mock",
      inputRef: "n/a",
      outputRef: "n/a",
      status: "SUCCESS",
      inputTokens: 1000,
      outputTokens: 1000,
      estimatedCostUsd: costUsd,
      createdAt,
    },
  });
}

afterEach(async () => {
  if (createdUserIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
});

describe("checkAIBudget", () => {
  it("allows a fresh FREE-plan user with no prior spend", async () => {
    const userId = await createTestUser();
    const result = await checkAIBudget(userId);
    expect(result.allowed).toBe(true);
    expect(result.spentTodayUsd).toBe(0);
  });

  it("blocks once today's recorded spend reaches the FREE daily budget", async () => {
    const userId = await createTestUser();
    const budgetUsd = Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
    await recordSpend(userId, budgetUsd);

    const result = await checkAIBudget(userId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/daily ai usage limit reached/i);
  });

  it("allows spend just under the budget and blocks the amount that reaches it", async () => {
    const userId = await createTestUser();
    const budgetUsd = Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
    await recordSpend(userId, budgetUsd - 0.01);

    expect((await checkAIBudget(userId)).allowed).toBe(true);

    await recordSpend(userId, 0.01);
    expect((await checkAIBudget(userId)).allowed).toBe(false);
  });

  it("does not count spend from before the start of the current UTC day", async () => {
    const userId = await createTestUser();
    const budgetUsd = Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await recordSpend(userId, budgetUsd * 5, yesterday);

    const result = await checkAIBudget(userId);
    expect(result.allowed).toBe(true);
    expect(result.spentTodayUsd).toBe(0);
  });

  it("does not count a FAILED/ERROR interaction's cost toward the budget", async () => {
    const userId = await createTestUser();
    const budgetUsd = Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
    await prisma.aIInteraction.create({
      data: {
        userId,
        toolName: "test.spend",
        provider: "mock",
        inputRef: "n/a",
        outputRef: "n/a",
        status: "ERROR",
        estimatedCostUsd: budgetUsd * 10,
      },
    });

    const result = await checkAIBudget(userId);
    expect(result.allowed).toBe(true);
    expect(result.spentTodayUsd).toBe(0);
  });

  it("gives a PRO-plan user a higher budget than a FREE-plan user", async () => {
    const userId = await createTestUser();
    const freeBudget = Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
    const proBudget = Number(process.env.AI_PRO_DAILY_BUDGET_USD ?? "5.00");
    expect(proBudget).toBeGreaterThan(freeBudget);

    // Spend more than the FREE budget but less than the PRO budget.
    await recordSpend(userId, freeBudget + 0.01);
    expect((await checkAIBudget(userId)).allowed).toBe(false);

    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: "PRO", status: "ACTIVE", stripeCustomerId: `cus_test_${userId}` },
      update: { plan: "PRO", status: "ACTIVE" },
    });

    const result = await checkAIBudget(userId);
    expect(result.allowed).toBe(true);
    expect(result.budgetUsd).toBe(proBudget);
  });
});
