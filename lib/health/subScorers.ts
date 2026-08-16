import type { ApplicationStatus, ConfidenceLevel, FollowUpStatus } from "@/lib/types/enums";

export interface SubScoreResult {
  score: number; // 0-100
  sampleSize: number; // how many underlying data points fed this score — 0 means "no data yet"
  facts: Record<string, unknown>; // every number the opportunity narrative (lib/health/opportunity.ts) can quote
}

// Same "progressed past a bare Applied" definition lib/assistant/intents/whyNotHearingBack.ts
// already uses for its response-rate stat.
const PROGRESSED_STATUSES: ApplicationStatus[] = [
  "RECRUITER_CONTACT",
  "SCREENING",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "ACCEPTED",
];

// Below this many applied applications, a progression rate is too noisy to report (one response
// out of one application is 100% or 0%, neither of which means anything) — same
// MIN_SAMPLE_FOR_ANY_STAT=3 threshold whyNotHearingBack.ts uses for its own comparison.
const MIN_APPLIED_FOR_PROGRESSION = 3;

// 8+ applications in the trailing 30 days reads as full marks on volume; below that, linear.
// Not derived from any external benchmark — a starting point, tunable once real usage exists.
const TARGET_APPLICATIONS_PER_30_DAYS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same weighting rule app/api/profile/route.ts already uses for its `overallConfidence` field —
 * extracted here so both places compute it identically instead of two formulas drifting apart.
 */
export const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  VERIFIED: 1,
  SUPPORTED_INFERENCE: 0.6,
  NOT_VERIFIED: 0.3,
  MISSING: 0,
};

export function computeConfidenceScore(entries: Array<{ confidence: ConfidenceLevel }>): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((s, e) => s + (CONFIDENCE_WEIGHT[e.confidence] ?? 0), 0);
  return Math.round((sum / entries.length) * 100);
}

/**
 * Blends the average quality of jobs the user is actually being scored against with whether
 * they've told the app what to look for at all — a user with strong preferences set is targeting
 * deliberately even before any job has been scored; a user with no preferences and mediocre
 * matches is casting a wide, unfocused net.
 */
export function scoreJobTargeting(
  matchScores: number[],
  preferences: { targetTitles: string[] | null; targetLocations: string[] | null; salaryFloor: number | null } | null
): SubScoreResult {
  const avgMatchScore = matchScores.length > 0 ? Math.round(matchScores.reduce((s, n) => s + n, 0) / matchScores.length) : null;

  const preferenceFlags = [
    (preferences?.targetTitles?.length ?? 0) > 0,
    (preferences?.targetLocations?.length ?? 0) > 0,
    preferences?.salaryFloor != null,
  ];
  const preferencesCompleteness = Math.round((preferenceFlags.filter(Boolean).length / preferenceFlags.length) * 100);

  const facts = { avgMatchScore, preferencesCompleteness, scoredJobCount: matchScores.length };

  if (matchScores.length === 0) {
    return { score: 0, sampleSize: 0, facts };
  }

  const score = Math.round((avgMatchScore ?? 0) * 0.85 + preferencesCompleteness * 0.15);
  return { score, sampleSize: matchScores.length, facts };
}

export function scoreResumeQuality(entries: Array<{ confidence: ConfidenceLevel }>): SubScoreResult {
  const verifiedCount = entries.filter((e) => e.confidence === "VERIFIED").length;
  const unverifiedOrInferredCount = entries.length - verifiedCount;
  const unverifiedPercent = entries.length > 0 ? Math.round((unverifiedOrInferredCount / entries.length) * 100) : 0;

  return {
    score: computeConfidenceScore(entries),
    sampleSize: entries.length,
    facts: { totalEntries: entries.length, verifiedCount, unverifiedPercent },
  };
}

export function scoreApplications(
  applications: Array<{ status: ApplicationStatus; appliedAt: Date | null }>,
  now: Date = new Date()
): SubScoreResult {
  const applied = applications.filter((a) => a.appliedAt !== null);
  const appliedCount = applied.length;

  if (appliedCount === 0) {
    return { score: 0, sampleSize: 0, facts: { appliedCount: 0, recentApplied: 0 } };
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const recentApplied = applied.filter((a) => a.appliedAt! >= thirtyDaysAgo).length;
  const volumeScore = Math.min(100, Math.round((recentApplied / TARGET_APPLICATIONS_PER_30_DAYS) * 100));

  if (appliedCount < MIN_APPLIED_FOR_PROGRESSION) {
    return {
      score: volumeScore,
      sampleSize: appliedCount,
      facts: { appliedCount, recentApplied, progressionRate: null },
    };
  }

  const progressedCount = applied.filter((a) => PROGRESSED_STATUSES.includes(a.status)).length;
  const progressionRate = Math.round((progressedCount / appliedCount) * 100);
  const score = Math.round(volumeScore * 0.5 + progressionRate * 0.5);

  return {
    score,
    sampleSize: appliedCount,
    facts: { appliedCount, recentApplied, progressionRate },
  };
}

/**
 * `activeJobs` are applications at PREPARING or later — jobs the user is seriously pursuing, not
 * just ones they've scored. For each, `hasSentOutreach` is true only if it has a real
 * Contact with a message that was actually marked SENT (a drafted-but-unsent message doesn't
 * count — see lib/health/computeCareerHealth.ts for exactly how this is derived).
 */
export function scoreNetworking(activeJobs: Array<{ hasSentOutreach: boolean }>): SubScoreResult {
  if (activeJobs.length === 0) {
    return { score: 0, sampleSize: 0, facts: { activeJobCount: 0, outreachCount: 0 } };
  }
  const outreachCount = activeJobs.filter((j) => j.hasSentOutreach).length;
  const score = Math.round((outreachCount / activeJobs.length) * 100);
  return { score, sampleSize: activeJobs.length, facts: { activeJobCount: activeJobs.length, outreachCount } };
}

export function scoreFollowUps(
  followUps: Array<{ status: FollowUpStatus; dueDate: Date }>,
  now: Date = new Date()
): SubScoreResult {
  if (followUps.length === 0) {
    return { score: 0, sampleSize: 0, facts: { totalFollowUps: 0, overdueCount: 0 } };
  }
  const overdueCount = followUps.filter((f) => f.status === "PENDING" && f.dueDate <= now).length;
  const onTrackCount = followUps.length - overdueCount;
  const score = Math.round((onTrackCount / followUps.length) * 100);
  return { score, sampleSize: followUps.length, facts: { totalFollowUps: followUps.length, overdueCount } };
}

export function scoreInterviewPrep(questions: Array<{ rehearsed: boolean }>): SubScoreResult {
  if (questions.length === 0) {
    return { score: 0, sampleSize: 0, facts: { totalQuestions: 0, rehearsedCount: 0 } };
  }
  const rehearsedCount = questions.filter((q) => q.rehearsed).length;
  const score = Math.round((rehearsedCount / questions.length) * 100);
  return { score, sampleSize: questions.length, facts: { totalQuestions: questions.length, rehearsedCount } };
}
