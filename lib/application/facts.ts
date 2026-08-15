import type { CareerProfileEntry } from "@prisma/client";
import type { JobRequirements } from "@/lib/ai/types";
import { buildDeterministicCustomization } from "@/lib/resume/customize";

export interface ApplicationFacts {
  jobTitle?: string;
  companyName?: string;
  /** Up to 3 required skills the profile actually has verified/inferred evidence for. */
  topMatchedSkills: string[];
  /** A single verified phrase — same one the resume customizer folds into the summary. */
  topRelevantPhrase?: string;
  /** The one entity the topRelevantPhrase traces back to — the only thing generation may cite. */
  citedEntities: Array<{ id: string; label: string; value: string }>;
}

/**
 * Reuses the resume customizer's deterministic selection logic (lib/resume/customize.ts) rather
 * than re-deriving "what's relevant to this job" a second way — cover letters and application
 * answers are grounded in exactly the same facts the tailored resume is.
 */
export function buildApplicationFacts(
  profileEntries: CareerProfileEntry[],
  job: JobRequirements,
  jobTitle?: string | null,
  companyName?: string | null
): ApplicationFacts {
  const deterministic = buildDeterministicCustomization(profileEntries, job);

  const topMatchedSkills = deterministic.skills
    .filter((s) => s.tag === "matched-required")
    .map((s) => s.value)
    .slice(0, 3);

  const sourceEntry = deterministic.topRelevantBullet
    ? profileEntries.find((e) => e.id === deterministic.topRelevantBullet!.entryId)
    : undefined;
  const citedEntities = sourceEntry
    ? [{ id: sourceEntry.id, label: sourceEntry.label ?? sourceEntry.value, value: sourceEntry.value }]
    : [];

  return {
    jobTitle: jobTitle ?? undefined,
    companyName: companyName ?? undefined,
    topMatchedSkills,
    topRelevantPhrase: deterministic.topRelevantBullet?.text,
    citedEntities,
  };
}
