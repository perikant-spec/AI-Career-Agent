import type { RationaleRequest, RationaleResult } from "@/lib/ai/types";

// Concrete fact shapes the match scorer (lib/scoring) populates when calling
// generateRationale — kept here so both sides agree on the contract without a shared
// "any" bag. Template-only: every sentence is built strictly from these fields, never from
// free generation, so there is nothing for the mock (or the real Claude provider, which is
// still gated by the Evidence Validator afterward) to hallucinate into it.
export interface MatchStrengthsGapsFacts {
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedNiceToHaveSkills: string[];
  requiredSkillsTotal: number;
  yearsExperienceActual?: number;
  yearsExperienceRequired?: number;
  seniorityDelta?: number; // profile ordinal - job ordinal
  locationSummary?: string;
  compensationSummary?: string;
}

export interface DisqualifierExplanationFacts {
  disqualifiers: Array<{ code: string; reason: string }>;
  wouldHaveScored: number;
}

function buildMatchStrengthsGaps(
  facts: MatchStrengthsGapsFacts,
  citedEntities: RationaleRequest["citedEntities"]
): { strengths: string[]; gaps: string[] } {
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (facts.matchedRequiredSkills.length > 0) {
    strengths.push(
      `Matches ${facts.matchedRequiredSkills.length}/${facts.requiredSkillsTotal} required skills, including ${facts.matchedRequiredSkills.slice(0, 3).join(", ")}.`
    );
  }
  if (facts.matchedNiceToHaveSkills.length > 0) {
    strengths.push(`Also covers ${facts.matchedNiceToHaveSkills.length} of the nice-to-have skills.`);
  }
  if (
    facts.yearsExperienceActual !== undefined &&
    facts.yearsExperienceRequired !== undefined &&
    facts.yearsExperienceActual >= facts.yearsExperienceRequired
  ) {
    strengths.push(
      `${facts.yearsExperienceActual} years of relevant experience clears the ${facts.yearsExperienceRequired}-year bar.`
    );
  }
  if (facts.locationSummary) strengths.push(facts.locationSummary);

  if (facts.missingRequiredSkills.length > 0) {
    gaps.push(
      `Missing ${facts.missingRequiredSkills.length} required skill${facts.missingRequiredSkills.length > 1 ? "s" : ""}: ${facts.missingRequiredSkills.slice(0, 3).join(", ")} — not found in the career profile.`
    );
  }
  if (
    facts.yearsExperienceActual !== undefined &&
    facts.yearsExperienceRequired !== undefined &&
    facts.yearsExperienceActual < facts.yearsExperienceRequired
  ) {
    gaps.push(
      `${facts.yearsExperienceActual} years of relevant experience is below the ${facts.yearsExperienceRequired}-year requirement.`
    );
  }
  if (facts.seniorityDelta !== undefined && Math.abs(facts.seniorityDelta) >= 2) {
    gaps.push(
      facts.seniorityDelta > 0
        ? "This role reads a level or two below your recent seniority."
        : "This role reads a level or two above your recent seniority."
    );
  }
  if (facts.compensationSummary) gaps.push(facts.compensationSummary);

  // Cited entities that back a matched skill get folded into the strength text implicitly —
  // the caller already filtered citedEntities to only what's relevant to this call.
  void citedEntities;

  if (strengths.length === 0) strengths.push("No strong category clears its usual bar for this posting.");
  if (gaps.length === 0) gaps.push("No significant gaps identified against the parsed requirements.");

  return { strengths, gaps };
}

function buildDisqualifierExplanation(facts: DisqualifierExplanationFacts): string {
  const reasons = facts.disqualifiers.map((d) => d.reason).join(" ");
  return `Would have scored ${facts.wouldHaveScored}, but marked Don't Apply because: ${reasons}`;
}

export function generateRationaleHeuristic(request: RationaleRequest): RationaleResult {
  const citedEntityIds = request.citedEntities.map((e) => e.id);

  if (request.kind === "MATCH_STRENGTHS_GAPS") {
    const { strengths, gaps } = buildMatchStrengthsGaps(
      request.facts as unknown as MatchStrengthsGapsFacts,
      request.citedEntities
    );
    return { text: [...strengths, ...gaps].join(" "), citedEntityIds, structured: { strengths, gaps } };
  }

  if (request.kind === "DISQUALIFIER_EXPLANATION") {
    return {
      text: buildDisqualifierExplanation(request.facts as unknown as DisqualifierExplanationFacts),
      citedEntityIds,
    };
  }

  // ASSISTANT_REPLY kind — generic fallback; the assistant orchestrator normally calls
  // generateAssistantReply() directly instead, which has its own per-intent templates.
  return { text: JSON.stringify(request.facts), citedEntityIds };
}
