import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/lib/types/enums";
import { zonedDayRangeUtc, currentLocalHourAndDate } from "@/lib/time";
import { whatShouldIApplyToday } from "@/lib/assistant/intents/whatShouldIApplyToday";
import {
  ACTIVELY_PURSUING_STATUSES,
  countNewJobs,
  countHighPriority,
  countFollowUpsDueToday,
  findWorthContacting,
  resolveUpcomingInterview,
  type HiringManagerCandidate,
  type InterviewCandidate,
} from "./subFacts";
import type { BriefingFacts } from "./types";

// A user's first-ever briefing has no prior DailyBriefingLog to diff "new jobs" against -- 24h is
// an honest, simple fallback window rather than claiming every job they've ever scored is "new".
const FIRST_BRIEFING_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** DB-loading orchestrator, mirroring lib/health/computeCareerHealth.ts's shape: parallel loads,
 *  pure sub-functions do the actual fact computation, this just wires real data into them. */
export async function computeBriefing(userId: string, now: Date = new Date()): Promise<BriefingFacts> {
  const preferences = await prisma.userPreferences.findUnique({ where: { userId }, select: { timezone: true } });
  const timezone = preferences?.timezone ?? "UTC";

  const [matchScores, applications, followUps, latestLog, recommended] = await Promise.all([
    prisma.matchScore.findMany({ where: { userId }, select: { createdAt: true, recommendationTier: true } }),
    prisma.application.findMany({
      where: { userId },
      select: {
        status: true,
        job: {
          select: {
            title: true,
            company: true,
            contacts: {
              select: {
                name: true,
                contactType: true,
                warmth: true,
                createdAt: true,
                messages: { select: { status: true } },
              },
            },
          },
        },
        interviewPrep: { select: { scheduledAt: true } },
      },
    }),
    prisma.followUp.findMany({ where: { userId, status: "PENDING" }, select: { status: true, dueDate: true } }),
    prisma.dailyBriefingLog.findFirst({ where: { userId }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    whatShouldIApplyToday(userId),
  ]);

  const since = latestLog?.sentAt ?? new Date(now.getTime() - FIRST_BRIEFING_LOOKBACK_MS);
  const newJobsCount = countNewJobs(matchScores, since);
  const highPriorityCount = countHighPriority(matchScores);

  const { localDate } = currentLocalHourAndDate(timezone, now);
  const [year, month, day] = localDate.split("-").map(Number);
  const dayRange = zonedDayRangeUtc({ year, month, day }, timezone);
  const followUpsDueTodayCount = countFollowUpsDueToday(followUps, dayRange);

  const activelyPursuing = applications.filter((a) => ACTIVELY_PURSUING_STATUSES.includes(a.status as ApplicationStatus));
  const hiringManagerCandidates: HiringManagerCandidate[] = activelyPursuing.flatMap((a) =>
    a.job.contacts
      .filter((c) => c.contactType === "HIRING_MANAGER")
      .map((c) => ({
        name: c.name,
        company: a.job.company ?? "this company",
        warmth: c.warmth,
        createdAt: c.createdAt,
        hasSentOutreach: c.messages.some((m) => m.status === "SENT"),
      }))
  );
  const worthContacting = findWorthContacting(hiringManagerCandidates);

  const interviewCandidates: InterviewCandidate[] = applications.map((a) => ({
    status: a.status,
    company: a.job.company ?? "this company",
    title: a.job.title ?? "this role",
    scheduledAt: a.interviewPrep?.scheduledAt ?? null,
  }));
  const upcomingInterview = resolveUpcomingInterview(interviewCandidates, now);

  const recommendedAction =
    recommended.jobs.length > 0
      ? { title: recommended.jobs[0].title, company: recommended.jobs[0].company, score: recommended.jobs[0].score }
      : null;

  return {
    timezone,
    newJobsCount,
    highPriorityCount,
    followUpsDueTodayCount,
    worthContacting,
    upcomingInterview,
    recommendedAction,
  };
}
