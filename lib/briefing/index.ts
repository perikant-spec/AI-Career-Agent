export { computeBriefing } from "./computeBriefing";
export { buildBriefingNarrative } from "./narrative";
export { isEligibleForBriefing, MORNING_WINDOW_START_HOUR, MORNING_WINDOW_END_HOUR } from "./cronEligibility";
export type { CronEligibilityInput } from "./cronEligibility";
export {
  ACTIVELY_PURSUING_STATUSES,
  countNewJobs,
  countHighPriority,
  countFollowUpsDueToday,
  findWorthContacting,
  resolveUpcomingInterview,
} from "./subFacts";
export type { HiringManagerCandidate, InterviewCandidate } from "./subFacts";
export type { BriefingFacts, BriefingNarrative, UpcomingInterview, RecommendedAction, WorthContacting } from "./types";
