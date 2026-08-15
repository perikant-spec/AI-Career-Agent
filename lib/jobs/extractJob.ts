import { getAIProvider } from "@/lib/ai";
import type { JobExtractionResult } from "@/lib/ai/types";

export interface JobExtractionWithProvider extends JobExtractionResult {
  provider: string;
  providerVersion: string;
}

/**
 * Job postings aren't candidate claims, so extraction here doesn't route through the Evidence
 * Validator (that gate exists to stop the product from fabricating things about the *user* —
 * job text is already verbatim what the user pasted in). Kept as its own thin wrapper anyway
 * so the AIInteraction audit trail is written consistently with the resume-extraction path.
 */
export async function extractJobRequirements(rawText: string): Promise<JobExtractionWithProvider> {
  const provider = getAIProvider();
  const extraction = await provider.extractJobRequirements(rawText);
  return { ...extraction, provider: provider.name, providerVersion: provider.version };
}
