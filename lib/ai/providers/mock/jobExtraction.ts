import type { JobExtractionResult, JobRequirements } from "@/lib/ai/types";
import { matchSkillsInText } from "./skillsTaxonomy";
import { matchCertificationsInText } from "./certifications";
import { classifySeniorityFromText } from "@/lib/text/seniority";

const NO_SPONSORSHIP_RE =
  /\b(no (visa )?sponsorship|not (able|eligible) to sponsor|must be authorized to work|us citizens? only|unable to sponsor|sponsorship is not (available|provided))\b/i;
const REQUIRED_SECTION_RE = /\b(required|requirements|must have|minimum qualifications)\b/i;
const PREFERRED_SECTION_RE = /\b(preferred|nice to have|bonus|plus)\b/i;

const SPARSE_TEXT_THRESHOLD = 400;

function splitByRequirementCue(text: string): { requiredText: string; preferredText: string } {
  const reqIdx = text.search(REQUIRED_SECTION_RE);
  const prefIdx = text.search(PREFERRED_SECTION_RE);

  if (reqIdx === -1 && prefIdx === -1) {
    return { requiredText: text, preferredText: "" };
  }
  if (prefIdx === -1) {
    return { requiredText: text.slice(reqIdx), preferredText: "" };
  }
  if (reqIdx === -1) {
    return { requiredText: "", preferredText: text.slice(prefIdx) };
  }
  return reqIdx < prefIdx
    ? { requiredText: text.slice(reqIdx, prefIdx), preferredText: text.slice(prefIdx) }
    : { requiredText: text.slice(reqIdx), preferredText: text.slice(prefIdx, reqIdx) };
}

function extractYearsExperience(text: string): number | undefined {
  const m = text.match(/(\d+)\+?\s*years?/i);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractSalaryRange(text: string): { min?: number; max?: number } {
  const rangeMatch = text.match(/\$\s?(\d[\d,]{2,})\s*(?:-|–|—|to)\s*\$?\s?(\d[\d,]{2,})/);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/,/g, ""), 10),
      max: parseInt(rangeMatch[2].replace(/,/g, ""), 10),
    };
  }
  const kRangeMatch = text.match(/\$\s?(\d{2,3})k\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3})k/i);
  if (kRangeMatch) {
    return { min: parseInt(kRangeMatch[1], 10) * 1000, max: parseInt(kRangeMatch[2], 10) * 1000 };
  }
  return {};
}

function extractRemotePolicy(text: string): JobRequirements["remotePolicy"] {
  if (/\bremote\b/i.test(text)) return "REMOTE";
  if (/\bhybrid\b/i.test(text)) return "HYBRID";
  if (/\bon-?site\b/i.test(text)) return "ONSITE";
  return "UNKNOWN";
}

function extractLocation(text: string): string | undefined {
  const m = text.match(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?),\s?([A-Z]{2})\b/);
  return m ? `${m[1]}, ${m[2]}` : undefined;
}

function extractTitle(text: string): string | undefined {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim();
  if (firstLine && firstLine.length < 80) return firstLine;
  return undefined;
}

function extractCompany(text: string): string | undefined {
  const hiringMatch = text.match(/^\s*([A-Z][\w&.,'-]{1,40}(?:\s[A-Z][\w&.,'-]{1,40}){0,3})\s+is\s+hiring\b/im);
  if (hiringMatch) return hiringMatch[1].trim();

  const labelMatch = text.match(/^\s*Company\s*:\s*(.+)$/im);
  if (labelMatch) return labelMatch[1].trim();

  return undefined;
}

export function extractJobRequirementsHeuristic(rawText: string): JobExtractionResult {
  const warnings: string[] = [];
  const trimmed = rawText.trim();

  const { requiredText, preferredText } = splitByRequirementCue(trimmed);
  const requiredSkills = matchSkillsInText(requiredText || trimmed);
  const niceToHaveSkills = matchSkillsInText(preferredText).filter((s) => !requiredSkills.includes(s));

  const minYearsExperience = extractYearsExperience(trimmed);
  const seniorityLevel = classifySeniorityFromText(trimmed);
  const requiredCertifications = matchCertificationsInText(requiredText || trimmed);
  const { min: salaryMin, max: salaryMax } = extractSalaryRange(trimmed);
  const remotePolicy = extractRemotePolicy(trimmed);
  const locationText = extractLocation(trimmed);
  const workAuthorizationRequirement = NO_SPONSORSHIP_RE.test(trimmed)
    ? "No visa sponsorship / must be authorized to work without sponsorship"
    : undefined;

  const parsedRequirements: JobRequirements = {
    requiredSkills,
    niceToHaveSkills,
    minYearsExperience,
    seniorityLevel,
    requiredCertifications,
    workAuthorizationRequirement,
    salaryMin,
    salaryMax,
    locationText,
    remotePolicy,
  };

  const populatedFieldCount = [
    requiredSkills.length > 0,
    minYearsExperience !== undefined,
    seniorityLevel !== undefined,
    requiredCertifications.length > 0,
    salaryMin !== undefined,
    locationText !== undefined,
  ].filter(Boolean).length;

  const isSparse = trimmed.length < SPARSE_TEXT_THRESHOLD || populatedFieldCount < 2;
  if (isSparse) {
    warnings.push(
      "This posting is short on detail — scoring will reflect lower confidence rather than a falsely precise number."
    );
  }

  return {
    title: extractTitle(trimmed),
    company: extractCompany(trimmed),
    location: locationText,
    parsedRequirements,
    extractionConfidence: isSparse ? "NOT_VERIFIED" : "VERIFIED",
    warnings,
  };
}
