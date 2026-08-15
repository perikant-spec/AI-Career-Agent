import { getAIProvider } from "@/lib/ai";
import { validateEntry } from "@/lib/evidence/validator";
import type { ExtractedProfileEntry } from "@/lib/ai/types";

export interface ExtractAndValidateResult {
  entries: ExtractedProfileEntry[];
  warnings: string[];
  conflicts: { description: string; relatedLabels: string[] }[];
  provider: string;
  providerVersion: string;
}

/**
 * Runs the AI provider's resume extraction and then the Evidence Validator hard gate on every
 * resulting entry — this is the only path allowed to produce CareerProfileEntry data. The
 * validator can only downgrade what the provider claimed, never upgrade it, and it recomputes
 * the authoritative source span whenever it finds an exact match, so a sloppy provider-reported
 * span never survives into persisted data uncorrected.
 */
export async function extractAndValidateResumeEntries(
  rawText: string,
  documentId: string
): Promise<ExtractAndValidateResult> {
  const provider = getAIProvider();
  const extraction = await provider.extractResumeEntities(rawText, documentId);

  const entries: ExtractedProfileEntry[] = extraction.entries.map((entry) => {
    const validation = validateEntry(entry, rawText);
    return {
      ...entry,
      confidence: validation.confidence,
      sourceSpan: validation.matchedVia === "EXACT" ? validation.span ?? entry.sourceSpan : entry.sourceSpan,
    };
  });

  return {
    entries,
    warnings: extraction.warnings,
    conflicts: extraction.conflicts,
    provider: provider.name,
    providerVersion: provider.version,
  };
}
