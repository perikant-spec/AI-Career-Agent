import { SENIORITY_RANK } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";
import type { ProfileSnapshot } from "@/lib/profile/profileSnapshot";
import type { PreferencesInput } from "./categoryScorers";

export interface Disqualifier {
  code: string;
  reason: string;
}

const SENIORITY_GAP_THRESHOLD = 3;
const NEEDS_SPONSORSHIP_RE =
  /need(s)?\s+(a\s+|an?\s+)?(visa\s+)?sponsorship|require(s)?\s+(a\s+|an?\s+)?(visa\s+)?sponsorship|not authorized|visa required/i;

/**
 * Independent of the weighted average — any hit here forces Don't Apply regardless of the
 * numeric score, per the PRD's "hard gate" design. The overall score is still computed and
 * shown alongside these so the user can see what it *would* have been.
 */
export function computeDisqualifiers(
  profile: ProfileSnapshot,
  job: JobRequirements,
  prefs: PreferencesInput | null
): Disqualifier[] {
  const disqualifiers: Disqualifier[] = [];

  if (job.requiredCertifications.length > 0) {
    const profileCerts = new Set(profile.certifications.map((c) => c.toLowerCase()));
    const missing = job.requiredCertifications.filter((c) => !profileCerts.has(c.toLowerCase()));
    if (missing.length > 0) {
      disqualifiers.push({
        code: "MISSING_REQUIRED_CERTIFICATION",
        reason: `Requires ${missing.join(", ")}, which ${missing.length > 1 ? "aren't" : "isn't"} on your profile.`,
      });
    }
  }

  // Only trigger when we have real signal on both sides — missing data pushes this to a risk
  // note elsewhere, never a silent disqualification.
  if (job.workAuthorizationRequirement && prefs?.workAuthorization && NEEDS_SPONSORSHIP_RE.test(prefs.workAuthorization)) {
    disqualifiers.push({
      code: "WORK_AUTHORIZATION_MISMATCH",
      reason: "This posting doesn't offer visa sponsorship, which conflicts with your stated work authorization.",
    });
  }

  if (profile.seniority && job.seniorityLevel) {
    const delta = Math.abs(SENIORITY_RANK[profile.seniority] - SENIORITY_RANK[job.seniorityLevel]);
    if (delta >= SENIORITY_GAP_THRESHOLD) {
      disqualifiers.push({
        code: "SENIORITY_GAP_BEYOND_THRESHOLD",
        reason: `This role reads ${delta} levels away from your recent seniority (${profile.seniority.toLowerCase()} vs. this posting's ${job.seniorityLevel.toLowerCase()}).`,
      });
    }
  }

  return disqualifiers;
}
