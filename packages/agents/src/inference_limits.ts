/** Per-attempt inference limits; not durable run/token/cost accounting. */
export interface AgentInferenceLimits {
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly maxOutputCharacters: number;
}
export const defaultAgentInferenceLimits: AgentInferenceLimits = Object.freeze({
  timeoutMs: 60_000, maxOutputTokens: 2048, maxOutputCharacters: 16_000,
});
export function normalizeAgentInferenceLimits(input: Partial<AgentInferenceLimits> = {}): AgentInferenceLimits {
  const result = { timeoutMs: input.timeoutMs ?? defaultAgentInferenceLimits.timeoutMs,
    maxOutputTokens: input.maxOutputTokens ?? defaultAgentInferenceLimits.maxOutputTokens,
    maxOutputCharacters: input.maxOutputCharacters ?? defaultAgentInferenceLimits.maxOutputCharacters };
  for (const [key, minimum, maximum] of [["timeoutMs",100,120_000], ["maxOutputTokens",128,8192],
    ["maxOutputCharacters",1,128_000]] as const) {
    if (!Number.isSafeInteger(result[key]) || result[key] < minimum || result[key] > maximum) {
      throw new RangeError("Invalid inference limit: " + key);
    }
  }
  return Object.freeze(result);
}

