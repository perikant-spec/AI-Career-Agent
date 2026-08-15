import { prisma } from "@/lib/prisma";
import {
  ENTITLED_STATUSES,
  FREE_JOB_IMPORT_CAP,
  PRO_FEATURE_LABELS,
  type Plan,
  type ProFeature,
  type SubscriptionStatus,
} from "./plans";

/** Lazily creates the FREE-plan row on first read — there's no separate "sign up for free"
 *  step, every user is implicitly on FREE until a checkout completes. */
async function getOrCreateSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.subscription.create({ data: { userId } });
}

// Pure logic, exported separately so it's unit-testable without a database — the async
// functions below are thin DB-fetching wrappers around these.

export function resolvePlan(plan: Plan, status: SubscriptionStatus): Plan {
  if (plan === "PRO" && ENTITLED_STATUSES.includes(status)) return "PRO";
  return "FREE";
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
}

export function checkJobCap(plan: Plan, used: number, importCount = 1): GateResult & { used: number; cap: number | null } {
  if (plan === "PRO") return { allowed: true, used, cap: null };

  const allowed = used + importCount <= FREE_JOB_IMPORT_CAP;
  return {
    allowed,
    used,
    cap: FREE_JOB_IMPORT_CAP,
    reason: allowed
      ? undefined
      : `Free plan is limited to ${FREE_JOB_IMPORT_CAP} tracked jobs. Upgrade to Pro for unlimited job tracking.`,
  };
}

export function checkProFeature(plan: Plan, feature: ProFeature): GateResult {
  if (plan === "PRO") return { allowed: true };
  return {
    allowed: false,
    reason: `${PRO_FEATURE_LABELS[feature]} requires the Pro plan.`,
  };
}

export async function getPlan(userId: string): Promise<Plan> {
  const sub = await getOrCreateSubscription(userId);
  return resolvePlan(sub.plan as Plan, sub.status as SubscriptionStatus);
}

export async function assertJobImportAllowed(userId: string, importCount = 1) {
  const plan = await getPlan(userId);
  const used = await prisma.job.count({ where: { userId } });
  return checkJobCap(plan, used, importCount);
}

export async function assertProFeature(userId: string, feature: ProFeature): Promise<GateResult> {
  const plan = await getPlan(userId);
  return checkProFeature(plan, feature);
}

export interface UsageSummary {
  plan: Plan;
  status: SubscriptionStatus;
  jobsUsed: number;
  jobCap: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const sub = await getOrCreateSubscription(userId);
  const plan = await getPlan(userId);
  const jobsUsed = await prisma.job.count({ where: { userId } });

  return {
    plan,
    status: sub.status as SubscriptionStatus,
    jobsUsed,
    jobCap: plan === "PRO" ? null : FREE_JOB_IMPORT_CAP,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}
