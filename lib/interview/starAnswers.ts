import type { CareerProfileEntry } from "@prisma/client";
import type { ConfidenceLevel } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";

const USABLE_CONFIDENCE = new Set<ConfidenceLevel>(["VERIFIED", "SUPPORTED_INFERENCE"]);
// Covers both symbol ("18%") and spelled-out ("18 percent") forms — PDF text extraction
// sometimes turns "%" into the word, so matching only the symbol silently missed real metrics.
// The "%" and "percent" alternatives are kept separate because \b can't anchor directly after
// "%" (a non-word character with no word/non-word transition to the punctuation that follows).
const METRIC_REGEX = /\d+(\.\d+)?%|\d+(\.\d+)?\s*percent\b|\$\d[\d,.]*[kKmMbB]?|\b\d+(\.\d+)?[xX]\b/i;

export interface RankedBullet {
  entryId: string;
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  text: string;
  matchCount: number;
}

/** All usable experience bullets, ranked by job-keyword overlap — the same relevance signal
 *  the resume customizer uses, but returning the full ordered list rather than just the top
 *  one, so distinct interview questions can draw on distinct pieces of evidence. */
export function rankExperienceBullets(profileEntries: CareerProfileEntry[], job: JobRequirements): RankedBullet[] {
  const usable = profileEntries.filter((e) => USABLE_CONFIDENCE.has(e.confidence as ConfidenceLevel));
  const experienceEntries = usable.filter((e) => e.section === "EXPERIENCE");
  const jobKeywords = [...job.requiredSkills, ...job.niceToHaveSkills];
  const normalize = (s: string) => s.toLowerCase().trim();

  const ranked: RankedBullet[] = [];
  for (const entry of experienceEntries) {
    const structured = entry.structuredData ? JSON.parse(entry.structuredData) : {};
    const bullets: string[] = structured.bullets ?? [];
    for (const text of bullets) {
      const matchCount = jobKeywords.filter((k) => normalize(text).includes(normalize(k))).length;
      ranked.push({
        entryId: entry.id,
        company: structured.company,
        title: structured.title,
        startDate: structured.startDate,
        endDate: structured.endDate,
        text,
        matchCount,
      });
    }
  }

  return ranked.sort((a, b) => b.matchCount - a.matchCount);
}

export interface StarAnswer {
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  citedEntityIds: string[];
}

/**
 * Fully deterministic, no AI call — Situation is built from the resume's own structured
 * company/title/dates (verified). Task is deliberately left null rather than invented: the
 * resume doesn't separately capture task-scope from action, so this is honest about that gap
 * instead of padding it out. Action/Result are mechanically split from the bullet's own text —
 * Result only populated when the bullet contains an extractable metric, never fabricated.
 */
export function buildStarAnswer(bullet: RankedBullet | undefined): StarAnswer {
  if (!bullet) {
    return { situation: null, task: null, action: null, result: null, citedEntityIds: [] };
  }

  const context = [bullet.title, bullet.company].filter(Boolean).join(" at ");
  const dateRange = bullet.startDate ? `${bullet.startDate}${bullet.endDate ? `–${bullet.endDate}` : ""}` : null;
  const situation = context ? `While working as ${context}${dateRange ? ` (${dateRange})` : ""}.` : null;

  const splitMatch = bullet.text.match(/^(.*?)(?:,|\bthat\b|\bwhich\b)\s+(.*)$/i);
  let action = bullet.text;
  let result: string | null = null;
  if (splitMatch && METRIC_REGEX.test(splitMatch[2])) {
    action = splitMatch[1].trim();
    result = splitMatch[2].trim().replace(/\.$/, "");
  }

  return {
    situation,
    task: null,
    action,
    result,
    citedEntityIds: [bullet.entryId],
  };
}
