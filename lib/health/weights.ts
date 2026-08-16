export const HEALTH_CATEGORIES = [
  "jobTargeting",
  "resumeQuality",
  "applications",
  "networking",
  "followUps",
  "interviewPrep",
] as const;
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];

export const HEALTH_CATEGORY_LABELS: Record<HealthCategory, string> = {
  jobTargeting: "Job targeting",
  resumeQuality: "Resume quality",
  applications: "Applications",
  networking: "Networking",
  followUps: "Follow-ups",
  interviewPrep: "Interview preparation",
};

// Equal weighting — no real-usage data yet to justify treating one area as more important than
// another. Configurable by design (kept separate from the composite/orchestrator logic), same
// "future tunability" rationale as lib/scoring/weights.ts#CATEGORY_WEIGHTS.
export const HEALTH_WEIGHTS: Record<HealthCategory, number> = {
  jobTargeting: 1 / 6,
  resumeQuality: 1 / 6,
  applications: 1 / 6,
  networking: 1 / 6,
  followUps: 1 / 6,
  interviewPrep: 1 / 6,
};
