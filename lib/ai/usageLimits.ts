import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/billing/entitlements";

// A daily USD budget ceiling per account, independent of the per-endpoint request-count rate
// limits (lib/security/rateLimit.ts) — request-count limits cap *how often* someone can call an
// AI endpoint, this caps *how much it can cost* even if every individual request stays under
// those limits (e.g. maximum-length messages on every call). Configurable via env so this can be
// tuned without a code change; defaults are deliberately conservative for an early-stage product.
function getFreeDailyBudgetUsd(): number {
  return Number(process.env.AI_FREE_DAILY_BUDGET_USD ?? "0.50");
}
function getProDailyBudgetUsd(): number {
  return Number(process.env.AI_PRO_DAILY_BUDGET_USD ?? "5.00");
}

export interface AIBudgetCheck {
  allowed: boolean;
  spentTodayUsd: number;
  budgetUsd: number;
  reason?: string;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Sums today's estimatedCostUsd for a user (mock-provider rows contribute 0, since their cost
 *  is null) and compares against their plan's daily budget. Call this *before* making an AI
 *  call — it reflects spend up to but not including the request currently being considered. */
export async function checkAIBudget(userId: string): Promise<AIBudgetCheck> {
  const plan = await getPlan(userId);
  const budgetUsd = plan === "PRO" ? getProDailyBudgetUsd() : getFreeDailyBudgetUsd();

  const result = await prisma.aIInteraction.aggregate({
    where: { userId, createdAt: { gte: startOfTodayUtc() }, status: "SUCCESS" },
    _sum: { estimatedCostUsd: true },
  });
  const spentTodayUsd = result._sum.estimatedCostUsd ?? 0;

  if (spentTodayUsd >= budgetUsd) {
    return {
      allowed: false,
      spentTodayUsd,
      budgetUsd,
      reason: `Daily AI usage limit reached ($${budgetUsd.toFixed(2)}). This resets at midnight UTC${plan === "FREE" ? ", or upgrade to Pro for a higher limit" : ""}.`,
    };
  }
  return { allowed: true, spentTodayUsd, budgetUsd };
}
