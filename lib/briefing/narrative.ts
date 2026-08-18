import { currentLocalHourAndDate } from "@/lib/time";
import type { BriefingFacts, BriefingNarrative } from "./types";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function localDateDiffDays(fromLocalDate: string, toLocalDate: string): number {
  const from = new Date(`${fromLocalDate}T00:00:00Z`).getTime();
  const to = new Date(`${toLocalDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function formatLocalTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
}

function formatLocalDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(instant);
}

function describeInterview(interview: NonNullable<BriefingFacts["upcomingInterview"]>, timezone: string, now: Date): string {
  if (!interview.hasTime) {
    return `You have an upcoming interview with ${interview.company}.`;
  }

  const { localDate: today } = currentLocalHourAndDate(timezone, now);
  const { localDate: interviewDay } = currentLocalHourAndDate(timezone, interview.scheduledAtUtc);
  const dayDiff = localDateDiffDays(today, interviewDay);

  const relativeDay = dayDiff === 0 ? "today" : dayDiff === 1 ? "tomorrow" : `on ${formatLocalDate(interview.scheduledAtUtc, timezone)}`;
  const time = formatLocalTime(interview.scheduledAtUtc, timezone);
  return `You have an interview with ${interview.company} ${relativeDay} at ${time}.`;
}

/** Fully deterministic -- every clause is a template filled directly from a BriefingFacts field,
 *  no AI call. Every clause is conditional on its fact being present; nothing is forced to make
 *  the copy read fuller than the real data supports (matches lib/health/opportunity.ts's
 *  never-imply-false-precision discipline). The interview clause in particular can only ever
 *  print a time when facts.upcomingInterview.hasTime is true -- a fabricated time is structurally
 *  unreachable, not just avoided by convention. */
export function buildBriefingNarrative(facts: BriefingFacts, now: Date = new Date()): BriefingNarrative {
  const lines: string[] = [];

  if (facts.newJobsCount > 0) {
    const verb = pluralize(facts.newJobsCount, "matches", "match");
    lines.push(`I found ${facts.newJobsCount} new ${pluralize(facts.newJobsCount, "job")} that ${verb} your profile.`);
  }
  if (facts.highPriorityCount > 0) {
    lines.push(`${facts.highPriorityCount} ${pluralize(facts.highPriorityCount, "is", "are")} high priority.`);
  }
  if (facts.followUpsDueTodayCount > 0) {
    lines.push(`You have ${facts.followUpsDueTodayCount} ${pluralize(facts.followUpsDueTodayCount, "follow-up")} due today.`);
  }
  if (facts.worthContacting) {
    lines.push(`${facts.worthContacting.name} at ${facts.worthContacting.company} is worth reaching out to.`);
  }
  if (facts.upcomingInterview) {
    lines.push(describeInterview(facts.upcomingInterview, facts.timezone, now));
  }
  if (facts.recommendedAction) {
    lines.push(
      `Recommended action: apply to ${facts.recommendedAction.company} first — your match score is ${facts.recommendedAction.score}%.`
    );
  }

  const pushTitle = "Good morning";

  if (lines.length === 0) {
    const fallback = "Nothing new to report right now — check back once you've scored a few more jobs or moved things along.";
    return { pushTitle, pushBody: fallback, cardHeadline: "Good morning.", cardLines: [fallback] };
  }

  return { pushTitle, pushBody: lines.join(" "), cardHeadline: "Good morning.", cardLines: lines };
}
