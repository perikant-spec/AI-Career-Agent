import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { validateCitations } from "@/lib/evidence/validator";
import { MATCH_CATEGORIES, type ConfidenceLevel, type MatchCategory, type RecommendationTier } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";
import type { MatchStrengthsGapsFacts, DisqualifierExplanationFacts } from "@/lib/ai/providers/mock/rationale";
import { buildProfileSnapshot, type ProfileSnapshot } from "@/lib/profile/profileSnapshot";
import {
  scoreSkills,
  scoreExperience,
  scoreSeniority,
  scoreIndustry,
  scoreLocation,
  scoreCompensation,
  scoreEducationCertification,
  scoreCareerTrajectory,
  type CategoryScoreResult,
  type PreferencesInput,
} from "./categoryScorers";
import { computeDisqualifiers, type Disqualifier } from "./disqualifiers";
import { CATEGORY_WEIGHTS } from "./weights";
import { deriveRecommendation } from "./tiers";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

export interface ComputedMatchScore {
  overallScore: number;
  categoryScores: Record<MatchCategory, number>;
  categoryConfidence: Record<MatchCategory, ConfidenceLevel>;
  categoryFacts: Record<MatchCategory, Record<string, unknown>>;
  disqualifiers: Disqualifier[];
  recommendationTier: RecommendationTier;
}

/**
 * Pure — no DB, no AI provider call. This is the deterministic, auditable core the PRD
 * requires: "the system should calculate the score using structured inputs, the AI explains
 * the score" — nothing here can be influenced by an LLM.
 */
export function computeMatchScore(
  profile: ProfileSnapshot,
  job: JobRequirements,
  prefs: PreferencesInput | null
): ComputedMatchScore {
  const results: Record<MatchCategory, CategoryScoreResult> = {
    skills: scoreSkills(profile.skills, job),
    experience: scoreExperience(profile, job),
    seniority: scoreSeniority(profile.seniority, job.seniorityLevel),
    industry: scoreIndustry(),
    location: scoreLocation(job, prefs),
    compensation: scoreCompensation(job, prefs),
    educationCertification: scoreEducationCertification(profile, job),
    careerTrajectory: scoreCareerTrajectory(profile.seniority, job.seniorityLevel),
  };

  const categoryScores = {} as Record<MatchCategory, number>;
  const categoryConfidence = {} as Record<MatchCategory, ConfidenceLevel>;
  const categoryFacts = {} as Record<MatchCategory, Record<string, unknown>>;
  let weightedSum = 0;

  for (const category of MATCH_CATEGORIES) {
    const result = results[category];
    categoryScores[category] = result.score;
    categoryConfidence[category] = result.confidence;
    categoryFacts[category] = result.facts;
    weightedSum += result.score * CATEGORY_WEIGHTS[category];
  }

  const overallScore = Math.round(weightedSum);
  const disqualifiers = computeDisqualifiers(profile, job, prefs);
  const recommendationTier = deriveRecommendation(overallScore, disqualifiers);

  return { overallScore, categoryScores, categoryConfidence, categoryFacts, disqualifiers, recommendationTier };
}

export interface PersistedMatchScore extends ComputedMatchScore {
  id: string;
  strengths: string[];
  gaps: string[];
}

/**
 * DB-integrated wrapper: loads the user's profile/job/preferences, computes the deterministic
 * score, then asks the AI provider only to *phrase* strengths/gaps text from the already-final
 * numbers — the rationale response has no field capable of touching overallScore/categoryScores/
 * disqualifiers, and its citations are checked against the real profile entries before being
 * persisted, exactly like the resume-extraction path.
 */
export async function scoreJobForUser(userId: string, jobId: string): Promise<PersistedMatchScore> {
  const [job, profileEntries, preferences] = await Promise.all([
    prisma.job.findFirstOrThrow({ where: { id: jobId, userId } }),
    prisma.careerProfileEntry.findMany({ where: { userId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);

  const profile = buildProfileSnapshot(profileEntries);
  const jobRequirements: JobRequirements = job.parsedRequirements
    ? JSON.parse(job.parsedRequirements)
    : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };

  const prefsInput: PreferencesInput | null = preferences
    ? {
        targetLocations: preferences.targetLocations ? JSON.parse(preferences.targetLocations) : [],
        salaryFloor: preferences.salaryFloor ?? undefined,
        workAuthorization: preferences.workAuthorization ?? undefined,
      }
    : null;

  const computed = computeMatchScore(profile, jobRequirements, prefsInput);

  const citableEntries = profileEntries.filter(
    (e) => e.section === "SKILL" || e.section === "EXPERIENCE"
  );
  const citedEntities = citableEntries.map((e) => ({ id: e.id, label: e.label ?? e.value, value: e.value }));
  const allowedEntityIds = new Set(citableEntries.map((e) => e.id));

  const provider = getAIProvider();
  let strengths: string[] = [];
  let gaps: string[] = [];
  let rationaleStatus: "SUCCESS" | "ERROR" = "SUCCESS";
  let usage = summarizeUsage([]);

  try {
    if (computed.disqualifiers.length > 0) {
      const facts: DisqualifierExplanationFacts = {
        disqualifiers: computed.disqualifiers,
        wouldHaveScored: computed.overallScore,
      };
      const tracked = await withUsageTracking(() =>
        provider.generateRationale({
          kind: "DISQUALIFIER_EXPLANATION",
          citedEntities,
          facts: facts as unknown as Record<string, unknown>,
        })
      );
      usage = summarizeUsage(tracked.usage);
      const result = tracked.result;
      const { valid } = validateCitations(result.citedEntityIds, allowedEntityIds);
      gaps = [valid ? result.text : "Disqualified — see the checklist for specifics."];
      strengths = [];
    } else {
      const facts: MatchStrengthsGapsFacts = {
        matchedRequiredSkills: computed.categoryFacts.skills.matchedRequiredSkills as string[],
        missingRequiredSkills: computed.categoryFacts.skills.missingRequiredSkills as string[],
        matchedNiceToHaveSkills: computed.categoryFacts.skills.matchedNiceToHaveSkills as string[],
        requiredSkillsTotal: computed.categoryFacts.skills.requiredSkillsTotal as number,
        yearsExperienceActual: computed.categoryFacts.experience.yearsExperienceActual as number | undefined,
        yearsExperienceRequired: computed.categoryFacts.experience.yearsExperienceRequired as number | undefined,
        seniorityDelta: computed.categoryFacts.seniority.seniorityDelta as number | undefined,
        locationSummary: computed.categoryFacts.location.locationSummary as string | undefined,
        compensationSummary: computed.categoryFacts.compensation.compensationSummary as string | undefined,
      };
      const tracked = await withUsageTracking(() =>
        provider.generateRationale({
          kind: "MATCH_STRENGTHS_GAPS",
          citedEntities,
          facts: facts as unknown as Record<string, unknown>,
        })
      );
      usage = summarizeUsage(tracked.usage);
      const result = tracked.result;
      const { valid } = validateCitations(result.citedEntityIds, allowedEntityIds);
      strengths = valid ? result.structured?.strengths ?? [] : [];
      gaps = valid ? result.structured?.gaps ?? [] : [];
    }
  } catch {
    rationaleStatus = "ERROR";
  }

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "match.score",
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: jobId,
      outputRef: `score=${computed.overallScore} tier=${computed.recommendationTier}`,
      status: rationaleStatus,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    },
  });

  const confidenceNote =
    job.extractionConfidence === "NOT_VERIFIED"
      ? "Sparse job posting text — treat this score as directional, not precise."
      : undefined;

  const saved = await prisma.matchScore.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: {
      userId,
      jobId,
      overallScore: computed.overallScore,
      categoryScores: JSON.stringify(computed.categoryScores),
      strengths: JSON.stringify(strengths),
      gaps: JSON.stringify(gaps),
      risks: JSON.stringify([]),
      disqualifiers: JSON.stringify(computed.disqualifiers),
      recommendationTier: computed.recommendationTier,
      confidenceNote,
      profileVersionHash: profile.versionHash,
    },
    update: {
      overallScore: computed.overallScore,
      categoryScores: JSON.stringify(computed.categoryScores),
      strengths: JSON.stringify(strengths),
      gaps: JSON.stringify(gaps),
      disqualifiers: JSON.stringify(computed.disqualifiers),
      recommendationTier: computed.recommendationTier,
      confidenceNote,
      profileVersionHash: profile.versionHash,
    },
  });

  return { ...computed, id: saved.id, strengths, gaps };
}
