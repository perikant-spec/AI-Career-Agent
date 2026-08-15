import { prisma } from "@/lib/prisma";

const APPLY_WORTHY_TIERS = ["APPLY_STRONG", "APPLY"];

/**
 * Reads only this user's Job + MatchScore rows — never fabricates a recommendation. If nothing
 * clears the threshold, says so explicitly rather than forcing a false-positive Apply.
 */
export async function whatShouldIApplyToday(userId: string) {
  const jobs = await prisma.job.findMany({
    where: { userId },
    include: { matchScores: true },
  });

  const scored = jobs.filter((j) => j.matchScores[0]);
  const applyWorthy = scored
    .filter((j) => APPLY_WORTHY_TIERS.includes(j.matchScores[0].recommendationTier))
    .sort((a, b) => b.matchScores[0].overallScore - a.matchScores[0].overallScore);

  if (applyWorthy.length === 0) {
    return { jobs: [], totalScored: scored.length };
  }

  return {
    jobs: applyWorthy.slice(0, 5).map((j) => ({
      title: j.title ?? "Untitled role",
      company: j.company ?? "Unknown company",
      score: j.matchScores[0].overallScore,
    })),
  };
}
