import { matchSkillsInText } from "@/lib/ai/providers/mock/skillsTaxonomy";
import type { ApplicationGenerationFacts } from "@/lib/ai/types";

/**
 * Second, independent layer of the Evidence Validator, alongside validateCitations
 * (lib/evidence/validator.ts). Citation checking proves the model referenced a real entity id;
 * it does not prove the *sentence it wrote* stayed within what that entity actually says. A
 * model can cite a valid id and still slip in a number or skill nobody gave it — "led a team of
 * 12 engineers" when the source only ever said "led a team", or naming a technology the
 * candidate never listed. This module re-checks the generated text itself, deterministically,
 * against everything the model was legitimately allowed to draw from: any number or
 * taxonomy-recognized skill in the output that doesn't also appear in the allowed input is an
 * unsupported claim and must be rejected — never silently kept.
 *
 * Same "structural check, not a second LLM call" philosophy as validateEntry: this is regex and
 * substring matching, not model judgment asked to grade its own work.
 */

// Percentages, dollar amounts, headcounts, "5+ years", plain counts — anything with a digit run.
// Deliberately broad: false positives (flagging a number that actually was grounded, if it's
// formatted slightly differently between input and output) fail closed into "reject and fall
// back to the deterministic content", which is the safe direction for an anti-hallucination gate.
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*\+?%?/g;

export function extractNumericClaims(text: string): string[] {
  return (text.match(NUMBER_PATTERN) ?? []).map((m) => m.trim()).filter(Boolean);
}

export interface ClaimValidationResult {
  valid: boolean;
  unsupportedNumbers: string[];
  unsupportedSkills: string[];
}

export function validateGeneratedClaims(generatedText: string, allowedSourceText: string): ClaimValidationResult {
  const allowedNumbers = new Set(extractNumericClaims(allowedSourceText));
  const unsupportedNumbers = extractNumericClaims(generatedText).filter((n) => !allowedNumbers.has(n));

  const allowedSkills = new Set(matchSkillsInText(allowedSourceText));
  const unsupportedSkills = matchSkillsInText(generatedText).filter((s) => !allowedSkills.has(s));

  return {
    valid: unsupportedNumbers.length === 0 && unsupportedSkills.length === 0,
    unsupportedNumbers,
    unsupportedSkills,
  };
}

/**
 * Every cover-letter/Q&A/outreach/follow-up call is grounded in the same
 * ApplicationGenerationFacts shape (lib/application/facts.ts#buildApplicationFacts) plus a
 * generator-specific field or two (daysSinceApplied, a contact's name/role/note). Concatenating
 * every field the model was actually given into one blob is exactly "everything it was
 * legitimately allowed to draw from" — the same text (modulo formatting) it received in the
 * prompt itself (see lib/ai/providers/anthropic/index.ts).
 */
export function allowedSourceTextFromFacts(facts: ApplicationGenerationFacts, extra: Array<string | number | undefined> = []): string {
  return [
    facts.jobTitle,
    facts.companyName,
    ...facts.topMatchedSkills,
    facts.topRelevantPhrase,
    ...facts.citedEntities.flatMap((e) => [e.label, e.value]),
    ...extra,
  ]
    .filter((v) => v !== undefined && v !== null)
    .map(String)
    .join("\n");
}
