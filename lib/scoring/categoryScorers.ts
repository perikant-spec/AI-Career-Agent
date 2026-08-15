import type { ConfidenceLevel, SeniorityLevel } from "@/lib/types/enums";
import { SENIORITY_RANK } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";
import type { ProfileSkill, ProfileSnapshot } from "@/lib/profile/profileSnapshot";

export interface CategoryScoreResult {
  score: number; // 0-100
  confidence: ConfidenceLevel;
  facts: Record<string, unknown>;
}

export interface PreferencesInput {
  targetLocations: string[];
  salaryFloor?: number;
  workAuthorization?: string;
}

function normalizeSkill(s: string): string {
  return s.trim().toLowerCase();
}

export function scoreSkills(profileSkills: ProfileSkill[], job: JobRequirements): CategoryScoreResult {
  const profileNames = new Set(profileSkills.map((s) => normalizeSkill(s.name)));
  const matchedRequiredSkills = job.requiredSkills.filter((s) => profileNames.has(normalizeSkill(s)));
  const missingRequiredSkills = job.requiredSkills.filter((s) => !profileNames.has(normalizeSkill(s)));
  const matchedNiceToHaveSkills = job.niceToHaveSkills.filter((s) => profileNames.has(normalizeSkill(s)));

  const facts = {
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedNiceToHaveSkills,
    requiredSkillsTotal: job.requiredSkills.length,
  };

  if (job.requiredSkills.length === 0) {
    if (job.niceToHaveSkills.length === 0) {
      return { score: 50, confidence: "NOT_VERIFIED", facts };
    }
    const ratio = matchedNiceToHaveSkills.length / job.niceToHaveSkills.length;
    return { score: Math.round(ratio * 100), confidence: "NOT_VERIFIED", facts };
  }

  const reqRatio = matchedRequiredSkills.length / job.requiredSkills.length;
  const niceRatio = job.niceToHaveSkills.length > 0 ? matchedNiceToHaveSkills.length / job.niceToHaveSkills.length : 1;
  const score = Math.round((reqRatio * 0.8 + niceRatio * 0.2) * 100);
  return { score, confidence: "VERIFIED", facts };
}

export function scoreExperience(profile: ProfileSnapshot, job: JobRequirements): CategoryScoreResult {
  const facts = {
    yearsExperienceActual: profile.yearsExperience,
    yearsExperienceRequired: job.minYearsExperience,
  };

  if (job.minYearsExperience === undefined) {
    return { score: 60, confidence: "NOT_VERIFIED", facts };
  }
  if (job.minYearsExperience === 0) {
    return { score: 100, confidence: "VERIFIED", facts };
  }
  const ratio = Math.min(1, profile.yearsExperience / job.minYearsExperience);
  return { score: Math.round(ratio * 100), confidence: "VERIFIED", facts };
}

export function scoreSeniority(
  profileSeniority: SeniorityLevel | undefined,
  jobSeniority: SeniorityLevel | undefined
): CategoryScoreResult {
  if (!profileSeniority || !jobSeniority) {
    return { score: 50, confidence: "NOT_VERIFIED", facts: { seniorityDelta: undefined } };
  }
  const delta = SENIORITY_RANK[profileSeniority] - SENIORITY_RANK[jobSeniority];
  const score = Math.max(0, 100 - Math.abs(delta) * 25);
  return { score, confidence: "VERIFIED", facts: { seniorityDelta: delta } };
}

/**
 * The heuristic mock provider doesn't extract an `industry` signal from either side (that
 * needs real language understanding, not keyword matching) — always neutral, low-confidence,
 * rather than fabricating a number. A real Claude-backed provider can do meaningfully better
 * here without any change to this scorer's contract.
 */
export function scoreIndustry(): CategoryScoreResult {
  return {
    score: 50,
    confidence: "NOT_VERIFIED",
    facts: { note: "Industry matching isn't supported by the heuristic provider yet." },
  };
}

export function scoreLocation(job: JobRequirements, prefs: PreferencesInput | null): CategoryScoreResult {
  if (job.remotePolicy === "REMOTE") {
    return {
      score: 100,
      confidence: "VERIFIED",
      facts: { locationSummary: "Fully remote — location isn't a constraint here." },
    };
  }

  const targetLocations = prefs?.targetLocations ?? [];
  if (targetLocations.length === 0 || !job.locationText) {
    return { score: 50, confidence: "NOT_VERIFIED", facts: {} };
  }

  const jobLoc = job.locationText.toLowerCase();
  const exact = targetLocations.some((loc) => jobLoc.includes(loc.toLowerCase()));
  if (exact) {
    return { score: 100, confidence: "VERIFIED", facts: { locationSummary: `Matches your target location (${job.locationText}).` } };
  }

  const jobState = job.locationText.match(/,\s*([A-Z]{2})\b/)?.[1];
  const sameState = jobState && targetLocations.some((loc) => loc.toUpperCase().includes(jobState));
  if (sameState) {
    return { score: 70, confidence: "VERIFIED", facts: { locationSummary: `Same state as a target location (${job.locationText}).` } };
  }

  return { score: 30, confidence: "VERIFIED", facts: { locationSummary: `${job.locationText} is outside your target locations.` } };
}

export function scoreCompensation(job: JobRequirements, prefs: PreferencesInput | null): CategoryScoreResult {
  const salaryFloor = prefs?.salaryFloor;
  const jobMin = job.salaryMin ?? job.salaryMax;
  const jobMax = job.salaryMax ?? job.salaryMin;

  if (!salaryFloor || jobMin === undefined || jobMax === undefined) {
    return { score: 50, confidence: "NOT_VERIFIED", facts: {} };
  }

  if (jobMin >= salaryFloor) {
    return { score: 100, confidence: "VERIFIED", facts: { compensationSummary: undefined } };
  }
  if (jobMax >= salaryFloor) {
    return {
      score: 70,
      confidence: "VERIFIED",
      facts: { compensationSummary: `Range partially clears your ${salaryFloor.toLocaleString()} floor.` },
    };
  }
  const score = Math.max(0, Math.round((jobMax / salaryFloor) * 60));
  return {
    score,
    confidence: "VERIFIED",
    facts: { compensationSummary: `Top of range is below your ${salaryFloor.toLocaleString()} floor.` },
  };
}

export function scoreEducationCertification(profile: ProfileSnapshot, job: JobRequirements): CategoryScoreResult {
  if (job.requiredCertifications.length === 0) {
    return { score: 100, confidence: "VERIFIED", facts: { missingCertifications: [] } };
  }

  const profileCerts = new Set(profile.certifications.map((c) => c.toLowerCase()));
  const missingCertifications = job.requiredCertifications.filter((c) => !profileCerts.has(c.toLowerCase()));
  const matched = job.requiredCertifications.length - missingCertifications.length;
  const score = Math.round((matched / job.requiredCertifications.length) * 100);
  return { score, confidence: "VERIFIED", facts: { missingCertifications } };
}

/**
 * Always SUPPORTED_INFERENCE — this is a derived judgment about career direction, never a
 * fact the way "years of experience" is, and must always be phrased as an inference downstream.
 */
export function scoreCareerTrajectory(
  profileSeniority: SeniorityLevel | undefined,
  jobSeniority: SeniorityLevel | undefined
): CategoryScoreResult {
  if (!profileSeniority || !jobSeniority) {
    return { score: 60, confidence: "NOT_VERIFIED", facts: {} };
  }
  const delta = SENIORITY_RANK[jobSeniority] - SENIORITY_RANK[profileSeniority];
  const score = delta >= 0 ? 90 : delta === -1 ? 60 : 30;
  return { score, confidence: "SUPPORTED_INFERENCE", facts: { trajectoryDelta: delta } };
}
