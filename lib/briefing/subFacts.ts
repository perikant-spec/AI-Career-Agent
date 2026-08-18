import type { ApplicationStatus, RecommendationTier } from "@/lib/types/enums";
import type { UpcomingInterview, WorthContacting } from "./types";

// Duplicated from lib/health/computeCareerHealth.ts's identical constant rather than imported --
// that module lives on the not-yet-merged feature/career-search-health branch, and this feature
// must not depend on an unmerged branch. Consolidate into a shared lib/applications/statuses.ts
// once that PR lands. Applications at PREPARING or later represent jobs the user is seriously
// pursuing, not just ones they've scored or shortlisted. Includes closed-out statuses
// (REJECTED/WITHDRAWN/ACCEPTED) deliberately: whether outreach ever happened is a historical fact
// about that pursuit regardless of how it ended.
export const ACTIVELY_PURSUING_STATUSES: ApplicationStatus[] = [
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

const INTERVIEW_STAGE_STATUSES: ApplicationStatus[] = ["INTERVIEW", "FINAL_INTERVIEW"];
const HIGH_PRIORITY_TIER: RecommendationTier = "APPLY_STRONG";

/** Jobs scored since the given cutoff (the last successfully-sent briefing, or 24h ago for a
 *  user's first-ever briefing) -- the "new" in "I found N new jobs." */
export function countNewJobs(matchScores: Array<{ createdAt: Date }>, since: Date): number {
  return matchScores.filter((m) => m.createdAt >= since).length;
}

/** Reuses the existing APPLY_STRONG (score >=85) tier as the "high priority" definition. */
export function countHighPriority(matchScores: Array<{ recommendationTier: string }>): number {
  return matchScores.filter((m) => m.recommendationTier === HIGH_PRIORITY_TIER).length;
}

/** PENDING follow-ups whose dueDate falls within the user's local calendar day. */
export function countFollowUpsDueToday(
  followUps: Array<{ status: string; dueDate: Date }>,
  localDayRangeUtc: { startUtc: Date; endUtc: Date }
): number {
  return followUps.filter(
    (f) => f.status === "PENDING" && f.dueDate >= localDayRangeUtc.startUtc && f.dueDate < localDayRangeUtc.endUtc
  ).length;
}

export interface HiringManagerCandidate {
  name: string;
  company: string;
  warmth: number | null;
  createdAt: Date;
  hasSentOutreach: boolean;
}

/** A HIRING_MANAGER contact on an actively-pursued application with zero SENT outreach messages
 *  yet -- a fresh, deterministic rule (no such heuristic existed anywhere in this codebase before
 *  this feature). Ties broken by highest warmth (nulls last), then most recently added. */
export function findWorthContacting(candidates: HiringManagerCandidate[]): WorthContacting | null {
  const uncontacted = candidates.filter((c) => !c.hasSentOutreach);
  if (uncontacted.length === 0) return null;

  const sorted = [...uncontacted].sort((a, b) => {
    const warmthA = a.warmth ?? -1;
    const warmthB = b.warmth ?? -1;
    if (warmthA !== warmthB) return warmthB - warmthA;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { name: sorted[0].name, company: sorted[0].company };
}

export interface InterviewCandidate {
  status: string;
  company: string;
  title: string;
  scheduledAt: Date | null;
}

/** Never fabricates a time: only reports scheduledAtUtc when a real one is stored and still in
 *  the future. An interview-stage application with no scheduledAt (or a past one) falls back to
 *  the honest hasTime:false shape rather than guessing. */
export function resolveUpcomingInterview(applications: InterviewCandidate[], now: Date): UpcomingInterview | null {
  const atInterviewStage = applications.filter((a) => INTERVIEW_STAGE_STATUSES.includes(a.status as ApplicationStatus));
  if (atInterviewStage.length === 0) return null;

  const withFutureTime = atInterviewStage
    .filter((a): a is InterviewCandidate & { scheduledAt: Date } => a.scheduledAt !== null && a.scheduledAt > now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  if (withFutureTime.length > 0) {
    const soonest = withFutureTime[0];
    return { hasTime: true, scheduledAtUtc: soonest.scheduledAt, company: soonest.company, title: soonest.title };
  }

  const first = atInterviewStage[0];
  return { hasTime: false, company: first.company, title: first.title };
}
