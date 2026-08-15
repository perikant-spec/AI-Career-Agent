import type { FollowUpMessageRequest, FollowUpMessageResult } from "@/lib/ai/types";

/**
 * Deliberately doesn't speculate about why there's been no response (busy hiring team, high
 * volume, etc.) — that's an invented claim about the employer's process. It just states the
 * fact (days since applying) and restates interest, grounded the same way a cover letter is.
 */
export function generateFollowUpMessageHeuristic(request: FollowUpMessageRequest): FollowUpMessageResult {
  const role = request.jobTitle ?? "this role";
  const at = request.companyName ? ` at ${request.companyName}` : "";
  const skillClause = request.topMatchedSkills.length > 0 ? ` My background in ${request.topMatchedSkills.join(", ")} is a strong fit.` : "";
  const achievementClause = request.topRelevantPhrase ? ` ${request.topRelevantPhrase}` : "";

  const content = `Hi, I applied for ${role}${at} ${request.daysSinceApplied} day${request.daysSinceApplied === 1 ? "" : "s"} ago and wanted to check in. Still very interested in the opportunity.${skillClause}${achievementClause} Happy to answer any questions in the meantime.`;

  return { content: content.trim(), citedEntityIds: request.citedEntities.map((e) => e.id) };
}
