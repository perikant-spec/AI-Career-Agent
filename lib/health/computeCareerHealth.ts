import { prisma } from "@/lib/prisma";
import type { ApplicationStatus, ConfidenceLevel, FollowUpStatus } from "@/lib/types/enums";
import {
  scoreJobTargeting,
  scoreResumeQuality,
  scoreApplications,
  scoreNetworking,
  scoreFollowUps,
  scoreInterviewPrep,
  type SubScoreResult,
} from "./subScorers";
import { HEALTH_CATEGORIES, HEALTH_CATEGORY_LABELS, HEALTH_WEIGHTS, type HealthCategory } from "./weights";
import { selectOpportunity, type OpportunityInsight } from "./opportunity";

export interface CareerHealthCategorySummary {
  key: HealthCategory;
  label: string;
  score: number;
  sampleSize: number;
}

export interface CareerHealthSummary {
  overallScore: number | null; // null only when every category has zero data
  categoriesUsed: number; // out of HEALTH_CATEGORIES.length — how many fed the composite
  categories: CareerHealthCategorySummary[];
  opportunity: OpportunityInsight;
}

// Applications at PREPARING or later represent jobs the user is seriously pursuing, not just
// ones they've scored or shortlisted — the denominator for the Networking sub-score. Includes
// closed-out statuses (REJECTED/WITHDRAWN/ACCEPTED) deliberately: whether outreach happened is a
// historical fact about that pursuit regardless of how it ended.
const ACTIVELY_PURSUING_STATUSES: ApplicationStatus[] = [
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "SCREENING",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

/**
 * DB-loading wrapper around the six pure scorers in lib/health/subScorers.ts — same split as
 * lib/scoring/scoreJob.ts (computeMatchScore is pure; scoreJobForUser loads data and calls it).
 * Every query here is scoped by userId, and results are computed purely from real rows — no AI
 * call anywhere in this file, matching this feature's whole point: the score and the narrative
 * that explains it are both facts, not guesses.
 */
export async function computeCareerHealth(userId: string): Promise<CareerHealthSummary> {
  const [matchScores, preferences, profileEntries, applications, followUps, interviewQuestions] = await Promise.all([
    prisma.matchScore.findMany({ where: { userId }, select: { overallScore: true } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.careerProfileEntry.findMany({ where: { userId }, select: { confidence: true } }),
    prisma.application.findMany({
      where: { userId },
      select: {
        status: true,
        appliedAt: true,
        job: { select: { contacts: { select: { messages: { select: { status: true } } } } } },
      },
    }),
    prisma.followUp.findMany({ where: { userId }, select: { status: true, dueDate: true } }),
    prisma.interviewQuestion.findMany({
      where: { interviewPrep: { userId } },
      select: { rehearsed: true },
    }),
  ]);

  const jobTargeting = scoreJobTargeting(
    matchScores.map((m) => m.overallScore),
    preferences
      ? {
          targetTitles: preferences.targetTitles ? JSON.parse(preferences.targetTitles) : null,
          targetLocations: preferences.targetLocations ? JSON.parse(preferences.targetLocations) : null,
          salaryFloor: preferences.salaryFloor,
        }
      : null
  );

  const resumeQuality = scoreResumeQuality(profileEntries.map((e) => ({ confidence: e.confidence as ConfidenceLevel })));

  const applicationsResult = scoreApplications(
    applications.map((a) => ({ status: a.status as ApplicationStatus, appliedAt: a.appliedAt }))
  );

  const activeJobs = applications
    .filter((a) => ACTIVELY_PURSUING_STATUSES.includes(a.status as ApplicationStatus))
    .map((a) => ({
      hasSentOutreach: a.job.contacts.some((c) => c.messages.some((m) => m.status === "SENT")),
    }));
  const networking = scoreNetworking(activeJobs);

  const followUpsResult = scoreFollowUps(followUps.map((f) => ({ status: f.status as FollowUpStatus, dueDate: f.dueDate })));

  const interviewPrep = scoreInterviewPrep(interviewQuestions);

  const results: Record<HealthCategory, SubScoreResult> = {
    jobTargeting,
    resumeQuality,
    applications: applicationsResult,
    networking,
    followUps: followUpsResult,
    interviewPrep,
  };

  const categories: CareerHealthCategorySummary[] = HEALTH_CATEGORIES.map((key) => ({
    key,
    label: HEALTH_CATEGORY_LABELS[key],
    score: results[key].score,
    sampleSize: results[key].sampleSize,
  }));

  // Categories with zero data are excluded and the remaining weights renormalized — never a fake
  // neutral default masquerading as a real measurement (same refusal-of-false-precision this app
  // applies everywhere else scores/averages are shown, e.g. the `n=` sample sizes on /analytics).
  const populated = HEALTH_CATEGORIES.filter((key) => results[key].sampleSize > 0);
  let overallScore: number | null = null;
  if (populated.length > 0) {
    const totalWeight = populated.reduce((sum, key) => sum + HEALTH_WEIGHTS[key], 0);
    const weightedSum = populated.reduce((sum, key) => sum + results[key].score * HEALTH_WEIGHTS[key], 0);
    overallScore = Math.round(weightedSum / totalWeight);
  }

  const opportunity = selectOpportunity(
    HEALTH_CATEGORIES.map((key) => ({ key, result: results[key] })),
    overallScore
  );

  return {
    overallScore,
    categoriesUsed: populated.length,
    categories,
    opportunity,
  };
}
