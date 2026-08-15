import type { JobRequirements } from "@/lib/ai/types";

const TOP_SKILLS_WINDOW = 5;

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Deterministic keyword-coverage score, 0-100 — no AI involvement, so before/after is always
 * directly comparable. A keyword scores full weight only if it's an exact skill in the first
 * few listed skills (real ATS keyword-density heuristics reward prominence, not just presence);
 * partial weight if it only shows up buried in skills/bullet text; zero if absent entirely.
 */
export function computeAtsScore(
  skillsInOrder: string[],
  bulletsText: string,
  job: JobRequirements
): number {
  const keywords = [...job.requiredSkills, ...job.niceToHaveSkills];
  if (keywords.length === 0) return 50; // nothing to score against — neutral, not fabricated precision

  const normalizedSkills = skillsInOrder.map(normalize);
  const topSkills = new Set(normalizedSkills.slice(0, TOP_SKILLS_WINDOW));
  const allSkills = new Set(normalizedSkills);
  const normalizedBullets = normalize(bulletsText);

  let total = 0;
  for (const keyword of keywords) {
    const norm = normalize(keyword);
    if (topSkills.has(norm)) total += 1;
    else if (allSkills.has(norm)) total += 0.85;
    else if (normalizedBullets.includes(norm)) total += 0.6;
    // else 0 — missing entirely
  }

  return Math.round((total / keywords.length) * 100);
}
