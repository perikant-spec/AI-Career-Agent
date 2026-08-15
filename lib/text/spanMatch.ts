import type { SourceSpan } from "@/lib/ai/types";

interface NormalizedIndex {
  normalized: string;
  /** map[i] = index into the original string that normalized[i] came from. */
  map: number[];
}

/**
 * Lowercases and collapses whitespace runs to single spaces, while keeping a per-character
 * map back to the original string's offsets — lets us report exact source spans even though
 * matching is whitespace/case-insensitive.
 */
export function buildNormalizedIndex(original: string): NormalizedIndex {
  let normalized = "";
  const map: number[] = [];
  let lastWasSpace = true; // treat leading whitespace as already-collapsed

  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        normalized += " ";
        map.push(i);
      }
      lastWasSpace = true;
    } else {
      normalized += ch.toLowerCase();
      map.push(i);
      lastWasSpace = false;
    }
  }

  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    map.pop();
  }

  return { normalized, map };
}

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Exact (whitespace/case-insensitive) substring search. Returns the span in the *original*
 * text, including original casing/whitespace, or null if no exact match exists. `fromIndex` is
 * a normalized-string offset (not an original-text offset) — pass the previous match's end to
 * progress monotonically through repeated text.
 */
export function findExactSpan(needle: string, haystack: string, fromIndex = 0): SourceSpan | null {
  const needleNormalized = normalizeForMatch(needle);
  if (!needleNormalized) return null;

  const { normalized, map } = buildNormalizedIndex(haystack);
  const idx = normalized.indexOf(needleNormalized, fromIndex);
  if (idx === -1) return null;

  const start = map[idx];
  const end = map[idx + needleNormalized.length - 1] + 1;
  return { start, end, text: haystack.slice(start, end) };
}

/** Jaccard token overlap, used for the fuzzy fallback pass. 0..1. */
function tokenOverlap(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Fuzzy fallback: slides a window (sized to needle's token count) across haystack looking for
 * token-overlap >= threshold. Used only when an exact match fails — the caller decides how
 * much confidence a fuzzy match can justify (never as much as an exact match).
 */
export function findFuzzySpan(
  needle: string,
  haystack: string,
  threshold = 0.6
): { overlap: number } | null {
  const needleTokens = normalizeForMatch(needle).split(" ").filter(Boolean);
  if (needleTokens.length === 0) return null;

  const haystackTokens = normalizeForMatch(haystack).split(" ").filter(Boolean);
  let best = 0;

  for (let i = 0; i <= haystackTokens.length - 1; i++) {
    const window = haystackTokens.slice(i, i + needleTokens.length);
    if (window.length === 0) continue;
    const overlap = tokenOverlap(needleTokens, window);
    if (overlap > best) best = overlap;
  }

  return best >= threshold ? { overlap: best } : null;
}
