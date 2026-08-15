import type { RecommendationTier } from "@/lib/types/enums";
import type { Disqualifier } from "./disqualifiers";

/**
 * Apply — Strong Match (>=85, no disqualifiers), Apply (70-84), Apply if Interested (55-69),
 * Low Priority (40-54), Don't Apply (<40 OR any disqualifier — hard gate wins regardless of score).
 */
export function deriveRecommendation(overallScore: number, disqualifiers: Disqualifier[]): RecommendationTier {
  if (disqualifiers.length > 0) return "DONT_APPLY";
  if (overallScore >= 85) return "APPLY_STRONG";
  if (overallScore >= 70) return "APPLY";
  if (overallScore >= 55) return "APPLY_IF_INTERESTED";
  if (overallScore >= 40) return "LOW_PRIORITY";
  return "DONT_APPLY";
}
