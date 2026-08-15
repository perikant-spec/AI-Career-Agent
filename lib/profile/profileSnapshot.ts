import type { CareerProfileEntry } from "@prisma/client";
import type { ConfidenceLevel, SeniorityLevel } from "@/lib/types/enums";
import { classifySeniorityFromText } from "@/lib/text/seniority";

export interface ProfileSkill {
  name: string;
  confidence: ConfidenceLevel;
}

export interface ProfileExperienceSnapshot {
  title?: string;
  company?: string;
  startYear?: number;
  endYear?: number; // 9999 for "present"/"current"
}

export interface ProfileSnapshot {
  skills: ProfileSkill[];
  certifications: string[];
  experience: ProfileExperienceSnapshot[];
  yearsExperience: number;
  seniority?: SeniorityLevel;
  /** Cheap change-detection key — recomputed match scores invalidate when this changes. */
  versionHash: string;
}

const USABLE_CONFIDENCE = new Set<ConfidenceLevel>(["VERIFIED", "SUPPORTED_INFERENCE"]);

function yearOf(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (/present|current/i.test(raw)) return 9999;
  const m = raw.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : undefined;
}

/**
 * Turns the raw CareerProfileEntry rows into the compact shape the scorer's category
 * functions actually consume. Only VERIFIED/SUPPORTED_INFERENCE entries count as usable
 * evidence — a NOT_VERIFIED or MISSING entry contributes nothing to matching, consistent with
 * the evidence layer's confidence semantics.
 */
export function buildProfileSnapshot(entries: CareerProfileEntry[]): ProfileSnapshot {
  const skills: ProfileSkill[] = [];
  const certifications: string[] = [];
  const experience: ProfileExperienceSnapshot[] = [];

  for (const entry of entries) {
    const confidence = entry.confidence as ConfidenceLevel;
    if (!USABLE_CONFIDENCE.has(confidence)) continue;

    if (entry.section === "SKILL") {
      skills.push({ name: entry.value, confidence });
    } else if (entry.section === "CERTIFICATION") {
      certifications.push(entry.value);
    } else if (entry.section === "EXPERIENCE") {
      const structured = entry.structuredData ? JSON.parse(entry.structuredData) : {};
      experience.push({
        title: structured.title,
        company: structured.company,
        startYear: yearOf(structured.startDate),
        endYear: yearOf(structured.endDate),
      });
    }
  }

  const validYears = experience.flatMap((e) => [e.startYear, e.endYear]).filter((y): y is number => !!y);
  const minYear = validYears.length ? Math.min(...validYears) : undefined;
  const maxYearRaw = validYears.length ? Math.max(...validYears) : undefined;
  const maxYear = maxYearRaw === 9999 ? new Date().getFullYear() : maxYearRaw;
  const yearsExperience = minYear !== undefined && maxYear !== undefined ? Math.max(0, maxYear - minYear) : 0;

  // Most recent role (largest endYear, "present" sorts first) drives the seniority read.
  const mostRecent = [...experience].sort((a, b) => (b.endYear ?? 0) - (a.endYear ?? 0))[0];
  const seniority = mostRecent?.title ? classifySeniorityFromText(mostRecent.title) : undefined;

  const versionHash = JSON.stringify({
    skills: skills.map((s) => s.name).sort(),
    certifications: certifications.sort(),
    experience: experience.length,
    yearsExperience,
    seniority,
  });

  return { skills, certifications, experience, yearsExperience, seniority, versionHash };
}
