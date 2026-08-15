import type { AIProvider } from "./types";
import { mockProvider } from "./providers/mock";

/**
 * The single branch point for provider selection in the entire codebase. No route, scorer,
 * or UI component should ever check `process.env.ANTHROPIC_API_KEY` itself — call this
 * instead. Lazily requires the Anthropic SDK-backed provider so it's never touched (and the
 * SDK never imported) when no key is configured.
 */
export function getAIProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { anthropicProvider } = require("./providers/anthropic") as {
      anthropicProvider: AIProvider;
    };
    return anthropicProvider;
  }
  return mockProvider;
}

export type * from "./types";
