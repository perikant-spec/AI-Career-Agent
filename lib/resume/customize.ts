import type { CareerProfileEntry } from "@prisma/client";
import type { ConfidenceLevel } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";
import { findTermAdaptation, applyTermAdaptation } from "./synonyms";

// Same usability bar as match scoring — a NOT_VERIFIED/MISSING entry contributes nothing.
const USABLE_CONFIDENCE = new Set<ConfidenceLevel>(["VERIFIED", "SUPPORTED_INFERENCE"]);

export interface TailoredSkill {
  value: string;
  tag: "matched-required" | "matched-nice" | "other";
}

export interface TailoredBullet {
  text: string;
  originalText: string;
  adapted: boolean;
  emphasized: boolean;
}

export interface TailoredExperienceEntry {
  entryId: string;
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  bullets: TailoredBullet[];
}

export interface ChangeLogEntry {
  kind: "REORDERED" | "EMPHASIZED" | "REWORDED" | "TERM_ADAPTED";
  text: string;
}

export interface DeterministicCustomization {
  skills: TailoredSkill[];
  experience: TailoredExperienceEntry[];
  changeLog: ChangeLogEntry[];
  /** Required skills/certs with no trace anywhere in the profile — shown as "left out on
   *  purpose" rather than silently invented. */
  leftOut: string[];
  /** The single most job-relevant verified bullet, handed to the AI provider as the one thing
   *  it's allowed to fold into the tailored summary. */
  topRelevantBullet?: { entryId: string; text: string };
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Pure, deterministic selection/reordering — this is the structural half of the "no new
 * entity introduced" guarantee (PRD §17): every value here traces back to a real
 * CareerProfileEntry row this function was handed. Wording adaptation is limited to the small
 * curated synonym list (lib/resume/synonyms.ts); anything more creative than that is the AI
 * provider's job on the single summary sentence, gated separately.
 */
export function buildDeterministicCustomization(
  profileEntries: CareerProfileEntry[],
  job: JobRequirements
): DeterministicCustomization {
  const usable = profileEntries.filter((e) => USABLE_CONFIDENCE.has(e.confidence as ConfidenceLevel));
  const changeLog: ChangeLogEntry[] = [];
  const appliedAdaptations = new Set<string>();

  const requiredLower = job.requiredSkills.map(normalize);
  const niceLower = job.niceToHaveSkills.map(normalize);
  const jobKeywords = [...job.requiredSkills, ...job.niceToHaveSkills];

  // --- Skills: required matches first, then nice-to-have matches, then everything else ---
  const skillEntries = usable.filter((e) => e.section === "SKILL");
  const taggedSkills: TailoredSkill[] = skillEntries.map((e) => {
    const norm = normalize(e.value);
    const tag: TailoredSkill["tag"] = requiredLower.includes(norm)
      ? "matched-required"
      : niceLower.includes(norm)
        ? "matched-nice"
        : "other";
    return { value: e.value, tag };
  });
  const rank: Record<TailoredSkill["tag"], number> = { "matched-required": 0, "matched-nice": 1, other: 2 };
  const orderedSkills = [...taggedSkills].sort((a, b) => rank[a.tag] - rank[b.tag]);

  const promoted = orderedSkills.filter((s) => s.tag !== "other").map((s) => s.value);
  const alreadyLed = taggedSkills.slice(0, promoted.length).every((s, i) => s.value === promoted[i]);
  if (promoted.length > 0 && !alreadyLed) {
    changeLog.push({
      kind: "REORDERED",
      text: `Reordered skills to lead with ${promoted.slice(0, 3).join(", ")}${promoted.length > 3 ? ", and others" : ""} — this posting asks for them directly.`,
    });
  }

  // --- Experience: reorder bullets by relevance within each role, apply term adaptation ---
  const experienceEntries = usable.filter((e) => e.section === "EXPERIENCE");

  let topRelevantBullet: { entryId: string; text: string } | undefined;
  let topRelevantScore = 0;
  // Job keywords addressed via term adaptation shouldn't also show up in "left out on
  // purpose" — the tailored text now literally contains the posting's preferred phrasing.
  const coveredByAdaptation = new Set<string>();

  const experience: TailoredExperienceEntry[] = experienceEntries.map((entry) => {
    const structured = entry.structuredData ? JSON.parse(entry.structuredData) : {};
    const bullets: string[] = structured.bullets ?? [];

    const scored = bullets.map((original) => {
      const matchCount = jobKeywords.filter((k) => normalize(original).includes(normalize(k))).length;

      const adaptation = findTermAdaptation(original, jobKeywords);
      const text = adaptation ? applyTermAdaptation(original, adaptation) : original;
      if (adaptation) {
        coveredByAdaptation.add(normalize(adaptation.to));
        const dedupeKey = `${adaptation.from}=>${adaptation.to}`;
        if (!appliedAdaptations.has(dedupeKey)) {
          appliedAdaptations.add(dedupeKey);
          changeLog.push({
            kind: "TERM_ADAPTED",
            text: `"${adaptation.from}" → "${adaptation.to}" — same verified work, this posting's preferred term.`,
          });
        }
      }

      return { original, text, matchCount, adapted: !!adaptation };
    });

    const orderedBullets = [...scored].sort((a, b) => b.matchCount - a.matchCount);
    const wasReordered = orderedBullets.some((b, i) => b.original !== scored[i]?.original);
    if (wasReordered && orderedBullets[0]?.matchCount > 0) {
      changeLog.push({
        kind: "EMPHASIZED",
        text: `Moved "${orderedBullets[0].original}" to the top of your ${structured.company ?? "role"} bullets — most relevant to this posting.`,
      });
    }

    if (orderedBullets[0] && orderedBullets[0].matchCount > topRelevantScore) {
      topRelevantScore = orderedBullets[0].matchCount;
      topRelevantBullet = { entryId: entry.id, text: orderedBullets[0].text };
    }

    return {
      entryId: entry.id,
      title: structured.title,
      company: structured.company,
      startDate: structured.startDate,
      endDate: structured.endDate,
      bullets: orderedBullets.map((b, i) => ({
        text: b.text,
        originalText: b.original,
        adapted: b.adapted,
        emphasized: i === 0 && b.matchCount > 0,
      })),
    };
  });

  // --- Left out on purpose: required skills/certs with no trace anywhere in the profile ---
  const allProfileText = normalize(usable.map((e) => `${e.value} ${e.structuredData ?? ""}`).join(" "));
  const missingSkills = job.requiredSkills.filter(
    (s) => !allProfileText.includes(normalize(s)) && !coveredByAdaptation.has(normalize(s))
  );
  const certValues = usable.filter((e) => e.section === "CERTIFICATION").map((e) => normalize(e.value));
  const missingCerts = job.requiredCertifications.filter((c) => !certValues.includes(normalize(c)));

  return {
    skills: orderedSkills,
    experience,
    changeLog,
    leftOut: [...missingSkills, ...missingCerts],
    topRelevantBullet: topRelevantScore > 0 ? topRelevantBullet : undefined,
  };
}
