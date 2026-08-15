import type { ResumeCustomizationRequest, ResumeCustomizationResult } from "@/lib/ai/types";

/**
 * Deliberately mechanical rather than naturalistic — the mock provider folds the one
 * deterministically-selected relevant phrase into the summary with a plain template instead of
 * attempting fluent rewriting, because fluent rewriting risks paraphrasing past what's
 * verifiable. The real Claude-backed provider can write something that reads more naturally;
 * both paths are constrained to the same citedEntities.
 */
export function generateResumeCustomizationHeuristic(
  request: ResumeCustomizationRequest
): ResumeCustomizationResult {
  const base = (request.masterSummary ?? "").trim();

  if (!request.topRelevantPhrase) {
    return { tailoredSummary: base, citedEntityIds: [] };
  }

  const clause = request.topRelevantPhrase.replace(/\.$/, "");
  const tailoredSummary = base
    ? `${base.replace(/\.$/, "")} — directly relevant: ${clause[0].toLowerCase()}${clause.slice(1)}.`
    : `Directly relevant: ${request.topRelevantPhrase}`;

  return { tailoredSummary, citedEntityIds: request.citedEntities.map((e) => e.id) };
}
