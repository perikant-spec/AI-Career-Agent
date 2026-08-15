import { prisma } from "@/lib/prisma";
import { bucketFunnel, countClosedOut, type FunnelStage } from "./funnel";

export interface AnalyticsSummary {
  totalApplications: number;
  funnel: FunnelStage[];
  closedOut: number;
  avgMatchScore: number | null;
  matchScoreSampleSize: number;
  avgAtsScore: number | null;
  atsScoreSampleSize: number;
  avgDaysToApply: number | null;
  daysToApplySampleSize: number;
}

function average(nums: number[]): number | null {
  return nums.length > 0 ? Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length) : null;
}

/** Every number here is a direct aggregate over the user's own rows — no AI call, nothing to
 *  fabricate. The Analytics page phrases these deterministically too, same as company research
 *  and STAR answers in the Interview Prep milestone. */
export async function computeAnalytics(userId: string): Promise<AnalyticsSummary> {
  const applications = await prisma.application.findMany({
    where: { userId },
    include: { job: { include: { matchScores: true } } },
  });
  const resumeVersions = await prisma.resumeVersion.findMany({ where: { userId } });

  const statuses = applications.map((a) => a.status);
  const funnel = bucketFunnel(statuses);
  const closedOut = countClosedOut(statuses);

  const matchScores = applications
    .map((a) => a.job.matchScores[0]?.overallScore)
    .filter((s): s is number => s !== undefined);
  const avgMatchScore = average(matchScores);

  const atsAfterScores = resumeVersions.map((r) => r.atsScoreAfter);
  const avgAtsScore = average(atsAfterScores);

  const daysToApply = applications
    .filter((a): a is typeof a & { appliedAt: Date } => a.appliedAt !== null)
    .map((a) => Math.max(0, Math.round((a.appliedAt.getTime() - a.discoveredAt.getTime()) / (1000 * 60 * 60 * 24))));
  const avgDaysToApply = average(daysToApply);

  return {
    totalApplications: applications.length,
    funnel,
    closedOut,
    avgMatchScore,
    matchScoreSampleSize: matchScores.length,
    avgAtsScore,
    atsScoreSampleSize: atsAfterScores.length,
    avgDaysToApply,
    daysToApplySampleSize: daysToApply.length,
  };
}
