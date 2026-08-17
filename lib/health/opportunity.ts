import type { HealthCategory } from "./weights";
import { HEALTH_CATEGORIES } from "./weights";
import type { SubScoreResult } from "./subScorers";

export interface CategoryWithResult {
  key: HealthCategory;
  result: SubScoreResult;
}

export type OpportunityKind = "opportunity" | "positive" | "onboarding";

export interface OpportunityInsight {
  kind: OpportunityKind;
  categoryKey: HealthCategory | null;
  headline: string;
  detail: string;
}

const GOOD_SCORE_THRESHOLD = 70;
const STRONG_COMPOSITE_THRESHOLD = 85;
const MIN_POPULATED_FOR_NARRATIVE = 2;

type TemplateFn = (facts: Record<string, unknown>) => { headline: string; detail: string };

/**
 * One template per category, each pulling only from that category's own `facts` (see
 * lib/health/subScorers.ts) — every number in the generated sentence traces back to a real,
 * already-computed value. Nothing here is AI-generated; this is the same
 * "phrase already-final facts, never invent one" discipline lib/scoring/scoreJob.ts's rationale
 * generation follows, just without the AI call at all — there's no wording variety worth the
 * cost/risk for six fixed sentence shapes.
 */
const TEMPLATES: Record<HealthCategory, TemplateFn> = {
  jobTargeting: (facts) => ({
    headline: "Your biggest opportunity is job targeting.",
    detail: `Your average match score across scored jobs is ${facts.avgMatchScore ?? "—"}, and your search preferences are ${facts.preferencesCompleteness ?? 0}% filled in. Narrowing in on roles that fit your background more closely — and telling the app what you're looking for — could raise the quality of what you're evaluating.`,
  }),
  resumeQuality: (facts) => ({
    headline: "Your biggest opportunity is resume quality.",
    detail: `${facts.unverifiedPercent ?? 0}% of your career profile is based on inference rather than a verified quote from your resume. Reviewing and confirming those entries could make your tailored resumes and cover letters more convincing.`,
  }),
  applications: (facts) => {
    const recentApplied = Number(facts.recentApplied ?? 0);
    return {
      headline: "Your biggest opportunity is application volume.",
      detail: `You've applied to ${recentApplied} job${recentApplied === 1 ? "" : "s"} in the last 30 days. Increasing how many quality applications you send out is the most direct way to create more opportunities.`,
    };
  },
  networking: (facts) => ({
    headline: "Your biggest opportunity is networking.",
    detail: `You're applying to jobs, but only ${facts.outreachCount ?? 0} of ${facts.activeJobCount ?? 0} applications you're actively pursuing have any outreach to a contact. Increasing targeted outreach to recruiters or hiring managers could improve your response rate.`,
  }),
  followUps: (facts) => ({
    headline: "Your biggest opportunity is following up.",
    detail: `${facts.overdueCount ?? 0} of your ${facts.totalFollowUps ?? 0} follow-ups are overdue. A quick nudge on those could re-open conversations that have gone quiet.`,
  }),
  interviewPrep: (facts) => ({
    headline: "Your biggest opportunity is interview preparation.",
    detail: `Only ${facts.rehearsedCount ?? 0} of ${facts.totalQuestions ?? 0} interview questions are marked rehearsed. A bit more practice before your next interview could make a real difference.`,
  }),
};

/**
 * Deterministic — no AI call, nothing to hallucinate. Picks the lowest-scoring category among
 * those with real data (ties broken by HEALTH_CATEGORIES's declared order, so the result is
 * stable rather than depending on object/array iteration order), unless every populated category
 * is already solid, in which case there's no honest "opportunity" to manufacture.
 */
export function selectOpportunity(categories: CategoryWithResult[], compositeScore: number | null): OpportunityInsight {
  const byKey = new Map(categories.map((c) => [c.key, c] as const));
  const populated = HEALTH_CATEGORIES.map((key) => byKey.get(key)).filter(
    (c): c is CategoryWithResult => c !== undefined && c.result.sampleSize > 0
  );

  if (populated.length < MIN_POPULATED_FOR_NARRATIVE) {
    return {
      kind: "onboarding",
      categoryKey: null,
      headline: "Your health score will sharpen as you use more of the app.",
      detail:
        "Score a few jobs, build out your profile, and start applying — each area unlocks its own signal once there's enough real activity to measure.",
    };
  }

  const allGood = populated.every((c) => c.result.score >= GOOD_SCORE_THRESHOLD);
  if (allGood && compositeScore !== null && compositeScore >= STRONG_COMPOSITE_THRESHOLD) {
    return {
      kind: "positive",
      categoryKey: null,
      headline: "You're in good shape across the board.",
      detail: "Every area with enough data to measure is scoring well — keep doing what you're doing.",
    };
  }

  const weakest = populated.reduce((min, c) => (c.result.score < min.result.score ? c : min));
  const { headline, detail } = TEMPLATES[weakest.key](weakest.result.facts);
  return { kind: "opportunity", categoryKey: weakest.key, headline, detail };
}
