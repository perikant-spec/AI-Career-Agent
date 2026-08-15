import type { Logger } from "./types";
import { consoleLogger } from "./providers/console";

// The single branch point for logger selection — same pattern as lib/ai#getAIProvider and
// lib/mail#getMailProvider. No real log-drain provider is wired in yet (no credentials exist in
// this environment); this is the swap point for one later (e.g. Sentry/Axiom/Datadog), gated on
// its own env var, the same way the AI/mail/billing providers are.
export function getLogger(): Logger {
  return consoleLogger;
}

export type * from "./types";
