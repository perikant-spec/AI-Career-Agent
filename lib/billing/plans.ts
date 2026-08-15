export const PLANS = ["FREE", "PRO"] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "INCOMPLETE"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Statuses under which a PRO subscription still grants PRO entitlements. PAST_DUE is
// deliberately excluded — Stripe keeps retrying the charge, but access shouldn't outlive a
// payment that's actually failing.
export const ENTITLED_STATUSES: readonly SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

// Free tier: track a handful of jobs and get match scores. Everything past "is this worth
// applying to" — the generated application package, outreach drafting, interview prep — is Pro.
export const FREE_JOB_IMPORT_CAP = 5;

export const PRO_FEATURES = [
  "APPLICATION_PACKAGE",
  "NETWORKING_OUTREACH",
  "INTERVIEW_PREP",
] as const;
export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  APPLICATION_PACKAGE: "Generating a tailored resume, cover letter, and screening answers",
  NETWORKING_OUTREACH: "Drafting networking outreach messages",
  INTERVIEW_PREP: "Interview preparation (company research, STAR answers, mock scoring)",
};

export function getProPriceId(): string | null {
  return process.env.STRIPE_PRO_PRICE_ID ?? null;
}
