export type UpcomingInterview =
  | { hasTime: true; scheduledAtUtc: Date; company: string; title: string }
  | { hasTime: false; company: string; title: string };

export interface RecommendedAction {
  title: string;
  company: string;
  score: number;
}

export interface WorthContacting {
  name: string;
  company: string;
}

export interface BriefingFacts {
  timezone: string;
  newJobsCount: number;
  highPriorityCount: number;
  followUpsDueTodayCount: number;
  worthContacting: WorthContacting | null;
  upcomingInterview: UpcomingInterview | null;
  recommendedAction: RecommendedAction | null;
}

export interface BriefingNarrative {
  pushTitle: string;
  pushBody: string;
  cardHeadline: string;
  cardLines: string[];
}
