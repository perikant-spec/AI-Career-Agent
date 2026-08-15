import type { SeniorityLevel } from "@/lib/types/enums";

const SENIORITY_KEYWORDS: Array<{ level: SeniorityLevel; regex: RegExp }> = [
  { level: "EXEC", regex: /\b(chief|vp|vice president|svp|evp|c-level)\b/i },
  { level: "DIRECTOR", regex: /\bdirector\b/i },
  // Excludes "Product/Program/Project/Account/Brand Manager" — those are common IC-track job
  // titles, not a signal that the role/person is at a people-management seniority level.
  {
    level: "MANAGER",
    regex: /(?<!\b(?:product|program|project|account|brand)\s)\bmanager\b|\bhead of\b/i,
  },
  { level: "PRINCIPAL", regex: /\bprincipal\b/i },
  { level: "STAFF", regex: /\bstaff\b/i },
  { level: "SENIOR", regex: /\b(senior|sr\.?|lead)\b/i },
  { level: "JUNIOR", regex: /\b(junior|jr\.?|entry.level|associate)\b/i },
  { level: "INTERN", regex: /\bintern(ship)?\b/i },
];

const REPORTING_LINE_RE = /\breport(?:s|ing)?\s+to\s+the\s+[^.\n]*/gi;

/**
 * Shared by job-requirement extraction (classifying the posting) and profile-snapshot
 * building (classifying the candidate's most recent title) so both sides of the seniority
 * match use identical rules.
 */
export function classifySeniorityFromText(text: string): SeniorityLevel | undefined {
  const withoutReportingLines = text.replace(REPORTING_LINE_RE, "");
  for (const { level, regex } of SENIORITY_KEYWORDS) {
    if (regex.test(withoutReportingLines)) return level;
  }
  return undefined;
}
