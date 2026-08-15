import { AsyncLocalStorage } from "async_hooks";

export interface AIUsageRecord {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// AsyncLocalStorage, not a module-level array — this module is a singleton shared by every
// concurrent request the server handles, so a plain array would let two overlapping requests'
// token counts bleed into each other. AsyncLocalStorage scopes a value to the async call chain
// that started it, which is exactly "one HTTP request" for every route handler in this app.
const storage = new AsyncLocalStorage<AIUsageRecord[]>();

/** Wrap a block of AI-provider calls to collect every token-usage record emitted inside it
 *  (there can be more than one, e.g. a flow that calls the provider twice). Call sites that
 *  create an AIInteraction row use this to get real token counts instead of nulls. */
export async function withUsageTracking<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AIUsageRecord[] }> {
  const records: AIUsageRecord[] = [];
  return storage.run(records, async () => {
    const result = await fn();
    return { result, usage: records };
  });
}

/** Called by each AI provider immediately after a real API call returns — the mock provider
 *  never calls this, since it never makes a real request and has no real token cost. */
export function recordUsage(record: AIUsageRecord): void {
  const records = storage.getStore();
  if (records) records.push(record);
}

/** Sums usage records from a single tracked block into one row's worth of numbers — most call
 *  sites make exactly one AI call per AIInteraction row, but this stays correct even when a flow
 *  makes several (the combined cost is still attributable to the one interaction being logged). */
export function summarizeUsage(usage: AIUsageRecord[]): { model: string | null; inputTokens: number | null; outputTokens: number | null } {
  if (usage.length === 0) return { model: null, inputTokens: null, outputTokens: null };
  return {
    model: usage[usage.length - 1].model,
    inputTokens: usage.reduce((sum, u) => sum + u.inputTokens, 0),
    outputTokens: usage.reduce((sum, u) => sum + u.outputTokens, 0),
  };
}
