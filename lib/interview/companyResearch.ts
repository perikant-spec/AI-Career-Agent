export interface ResearchSnippet {
  label: string;
  text: string;
}

// Deterministic extraction from the job posting's own text — never fabricated "general
// knowledge" about the company. No web-research/scraping capability exists in this build, and
// asking an LLM to recall company facts from memory risks confident, unverifiable hallucination,
// so this stays a pure text-extraction step regardless of which AI provider is active.
const PATTERNS: Array<{ label: string; keywords: RegExp }> = [
  { label: "Mission & values", keywords: /\b(mission|values|we believe|our culture)\b/i },
  { label: "Team & structure", keywords: /\b(team|reports? to|cross-functional|squad)\b/i },
  { label: "Tech & tools", keywords: /\b(stack|tools?|technolog(y|ies)|built (with|on)|using)\b/i },
  { label: "About the company", keywords: /\b(about us|we are|we're|founded|headquartered)\b/i },
];

export function extractCompanyResearch(rawText: string): ResearchSnippet[] {
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 20 && s.length < 300);

  const used = new Set<string>();
  const snippets: ResearchSnippet[] = [];

  for (const { label, keywords } of PATTERNS) {
    const match = sentences.find((s) => keywords.test(s) && !used.has(s));
    if (match) {
      snippets.push({ label, text: match });
      used.add(match);
    }
  }

  return snippets;
}
