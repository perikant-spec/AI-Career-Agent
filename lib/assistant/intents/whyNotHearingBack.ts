import { prisma } from "@/lib/prisma";

const PROGRESSED_STATUSES = ["RECRUITER_CONTACT", "SCREENING", "INTERVIEW", "FINAL_INTERVIEW", "OFFER", "ACCEPTED"];
const MIN_SAMPLE_FOR_ANY_STAT = 3;
const MIN_GROUP_SIZE_FOR_COMPARISON = 2;

/**
 * Deterministic funnel math only — no AI call computes these numbers, so there's nothing to
 * fabricate. Explicitly refuses to state a comparison (e.g. "higher-scored applications get
 * more responses") unless both groups being compared have enough data points, and always states
 * the sample size alongside any stat so nothing reads as more confident than the data supports
 * (PRD §22: "avoid false precision when a user has few data points").
 */
export async function whyNotHearingBack(userId: string) {
  const applications = await prisma.application.findMany({
    where: { userId, appliedAt: { not: null } },
    include: { job: { include: { matchScores: true } } },
  });

  const totalApplied = applications.length;
  if (totalApplied < MIN_SAMPLE_FOR_ANY_STAT) {
    return {
      available: true,
      sampleSize: totalApplied,
      tooFewToAnalyze: true,
    };
  }

  const progressed = applications.filter((a) => PROGRESSED_STATUSES.includes(a.status));
  const stuck = applications.filter((a) => a.status === "APPLIED");

  const scoreOf = (a: (typeof applications)[number]) => a.job.matchScores[0]?.overallScore;
  const avg = (nums: number[]) => (nums.length > 0 ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null);

  const progressedScores = progressed.map(scoreOf).filter((s): s is number => s !== undefined);
  const stuckScores = stuck.map(scoreOf).filter((s): s is number => s !== undefined);

  const overdueFollowUps = await prisma.followUp.count({
    where: { userId, status: "PENDING", dueDate: { lte: new Date() } },
  });

  const canCompareScores =
    progressedScores.length >= MIN_GROUP_SIZE_FOR_COMPARISON && stuckScores.length >= MIN_GROUP_SIZE_FOR_COMPARISON;

  return {
    available: true,
    sampleSize: totalApplied,
    tooFewToAnalyze: false,
    responseCount: progressed.length,
    responseRate: Math.round((progressed.length / totalApplied) * 100),
    overdueFollowUps,
    canCompareScores,
    avgScoreProgressed: canCompareScores ? avg(progressedScores) : null,
    avgScoreStuck: canCompareScores ? avg(stuckScores) : null,
    progressedSampleSize: progressedScores.length,
    stuckSampleSize: stuckScores.length,
  };
}
