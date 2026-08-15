import { prisma } from "@/lib/prisma";
import { RECOMMENDATION_LABELS, type RecommendationTier } from "@/lib/types/enums";

export async function explainJobScore(userId: string, query: string) {
  const jobs = await prisma.job.findMany({
    where: { userId },
    include: { matchScores: true },
  });

  const q = query.toLowerCase();
  const match = jobs.find((j) => {
    const title = (j.title ?? "").toLowerCase();
    const company = (j.company ?? "").toLowerCase();
    return (
      (title && (title.includes(q) || q.includes(title))) ||
      (company && (company.includes(q) || q.includes(company)))
    );
  });

  if (!match || !match.matchScores[0]) {
    return { found: false };
  }

  const ms = match.matchScores[0];
  const disqualifiers = (JSON.parse(ms.disqualifiers) as Array<{ reason: string }>).map((d) => d.reason);
  const gaps = JSON.parse(ms.gaps) as string[];

  return {
    found: true,
    job: { title: match.title ?? "Untitled role", company: match.company ?? "Unknown company" },
    score: ms.overallScore,
    tierLabel: RECOMMENDATION_LABELS[ms.recommendationTier as RecommendationTier],
    disqualifiers,
    topGaps: gaps.slice(0, 2),
  };
}
