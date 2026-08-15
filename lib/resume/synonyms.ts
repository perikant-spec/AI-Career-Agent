// Curated ATS-equivalent term pairs — deliberately small and disclosed as a limitation, not
// exhaustive. "Term choice can be adapted; the underlying claim cannot change" (PRD §17): a
// swap is only ever surfaced when the *same verified work* is being described in the posting's
// preferred vocabulary, never when it would imply new scope or seniority.
export const ATS_TERM_SYNONYMS: Array<{ resumeTerm: string; equivalents: string[] }> = [
  { resumeTerm: "customer support", equivalents: ["client success", "customer success"] },
  { resumeTerm: "roadmapping", equivalents: ["roadmap ownership", "product roadmap"] },
  { resumeTerm: "stakeholder management", equivalents: ["cross-functional collaboration", "cross-functional leadership"] },
  { resumeTerm: "a/b testing", equivalents: ["experimentation", "split testing"] },
  { resumeTerm: "product management", equivalents: ["product strategy", "product leadership"] },
  { resumeTerm: "team leadership", equivalents: ["people management", "team management"] },
  { resumeTerm: "data visualization", equivalents: ["data storytelling", "reporting"] },
  { resumeTerm: "sales", equivalents: ["business development", "revenue generation"] },
];

export interface TermAdaptation {
  from: string;
  to: string;
}

/**
 * Looks for a resume term (verbatim, case-insensitive) inside `text` that has an equivalent
 * phrase among `jobKeywords` — meaning the posting phrases the same skill differently than the
 * resume does. Returns the first match only; the caller decides how many swaps to apply.
 */
export function findTermAdaptation(text: string, jobKeywords: string[]): TermAdaptation | null {
  const lowerText = text.toLowerCase();
  const lowerJobKeywords = jobKeywords.map((k) => k.toLowerCase());

  for (const { resumeTerm, equivalents } of ATS_TERM_SYNONYMS) {
    if (!lowerText.includes(resumeTerm)) continue;
    // Already using the job's preferred phrasing somewhere? No swap needed.
    if (lowerJobKeywords.includes(resumeTerm)) continue;

    const matchedEquivalent = equivalents.find((eq) => lowerJobKeywords.includes(eq.toLowerCase()));
    if (matchedEquivalent) {
      return { from: resumeTerm, to: matchedEquivalent };
    }
  }

  return null;
}

export function applyTermAdaptation(text: string, adaptation: TermAdaptation): string {
  const pattern = new RegExp(adaptation.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return text.replace(pattern, adaptation.to);
}
