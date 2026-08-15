import type { ConfidenceLevel } from "@/lib/types/enums";
import { CONFIDENCE_RANK } from "@/lib/types/enums";
import type { SourceSpan } from "@/lib/ai/types";
import { findExactSpan, findFuzzySpan } from "@/lib/text/spanMatch";

export interface ValidationResult {
  /** Never higher than the claimed confidence that was passed in — this function only downgrades. */
  confidence: ConfidenceLevel;
  /** Present only when the match was EXACT. */
  span?: SourceSpan;
  matchedVia: "EXACT" | "FUZZY" | "NONE";
}

export interface ValidatableEntry {
  value: string;
  confidence: ConfidenceLevel;
  /** The specific quote this entry's claim rests on — for VERIFIED entries this is normally
   *  the value itself; for SUPPORTED_INFERENCE entries it's the underlying evidence quote
   *  (e.g. the resume bullet a derived skill was inferred from), not the derived label. */
  sourceSpan?: SourceSpan;
}

/**
 * `min(claimed, structurallyJustified)` on the ordinal confidence scale — the one deterministic
 * rule the whole evidence layer rests on. Nothing outside this module is allowed to set a
 * CareerProfileEntry's confidence directly; every write path (resume extraction, manual edit,
 * generated rationale text) routes through here first.
 */
function downgradeOnly(claimed: ConfidenceLevel, structural: ConfidenceLevel): ConfidenceLevel {
  return CONFIDENCE_RANK[structural] < CONFIDENCE_RANK[claimed] ? structural : claimed;
}

const FUZZY_OVERLAP_THRESHOLD = 0.6;

/**
 * Structural, deterministic check — normalized substring matching against the actual source
 * text, never a second LLM call asked to "double-check itself". This is the hard gate: run it
 * after every extraction, every manual edit, and every generated rationale sentence before any
 * of that content is persisted or shown to the user.
 */
export function validateEntry(entry: ValidatableEntry, sourceText: string): ValidationResult {
  if (entry.confidence === "MISSING") {
    return { confidence: "MISSING", matchedVia: "NONE" };
  }

  // What we actually check against the source is the entry's cited quote — its sourceSpan
  // text if it has one (that's the real evidentiary claim), falling back to the entry's own
  // value only when no span was ever recorded (e.g. a value with no citation at all).
  const quote = entry.sourceSpan?.text ?? entry.value;

  if (!quote || !quote.trim()) {
    return { confidence: downgradeOnly(entry.confidence, "NOT_VERIFIED"), matchedVia: "NONE" };
  }

  const exact = findExactSpan(quote, sourceText);
  if (exact) {
    return {
      confidence: downgradeOnly(entry.confidence, "VERIFIED"),
      span: exact,
      matchedVia: "EXACT",
    };
  }

  const fuzzy = findFuzzySpan(quote, sourceText, FUZZY_OVERLAP_THRESHOLD);
  if (fuzzy) {
    // Fuzzy can justify at most SUPPORTED_INFERENCE — it can never be the basis for VERIFIED.
    return { confidence: downgradeOnly(entry.confidence, "SUPPORTED_INFERENCE"), matchedVia: "FUZZY" };
  }

  return { confidence: downgradeOnly(entry.confidence, "NOT_VERIFIED"), matchedVia: "NONE" };
}

/**
 * A user cannot self-declare VERIFIED (or SUPPORTED_INFERENCE) on a manually-added entry —
 * there is no source document to check it against. Hard-pin to NOT_VERIFIED regardless of
 * what the client sent.
 */
export function pinManualEntryConfidence(): ConfidenceLevel {
  return "NOT_VERIFIED";
}

/**
 * Validates a generated rationale/assistant sentence's citations: every citedEntityId must
 * resolve to a real, user-owned entity the caller actually passed in as citable. Anything that
 * cites an id outside that set is a fabricated reference and must be stripped, never kept.
 */
export function validateCitations(
  citedEntityIds: string[],
  allowedEntityIds: ReadonlySet<string>
): { valid: boolean; invalidIds: string[] } {
  const invalidIds = citedEntityIds.filter((id) => !allowedEntityIds.has(id));
  return { valid: invalidIds.length === 0, invalidIds };
}
