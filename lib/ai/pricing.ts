// Approximate USD cost per token, for usage monitoring and the AI budget cap
// (lib/ai/usageLimits.ts) — a directional cost signal, not an exact invoice. Verify against
// Anthropic's current published pricing (anthropic.com/pricing) before using these numbers for
// real financial decisions or customer-facing billing; model pricing changes over time and this
// table is not automatically kept in sync with it.
const PRICE_PER_TOKEN_USD: Record<string, { input: number; output: number }> = {
  // Sonnet-class pricing as a reasonable default: $3 / 1M input tokens, $15 / 1M output tokens.
  default: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
};

export function estimateCostUsd(model: string | null, inputTokens: number | null, outputTokens: number | null): number | null {
  if (model === null || inputTokens === null || outputTokens === null) return null;
  const price = PRICE_PER_TOKEN_USD[model] ?? PRICE_PER_TOKEN_USD.default;
  return inputTokens * price.input + outputTokens * price.output;
}
