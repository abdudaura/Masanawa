/**
 * Pure fail-closed admission guard for existing agent-turn workers.
 * Does NOT introduce a second queue, consumer, or message journal.
 * AF00 composes it into the canonical agent execution path.
 */
export async function admitMasanaChatExecution(input: {
  readonly tenantId: string;
  readonly characterId: string;
  readonly actorKind: "fan" | "staff" | "agent" | "unknown";
  readonly approved: (scope: { tenantId: string; characterId: string }) => Promise<boolean>;
  readonly featureEnabled: boolean;
}): Promise<boolean> {
  if (!input.featureEnabled || input.actorKind !== "fan" ||
      !input.tenantId || !input.characterId) return false;
  try {
    return await input.approved({
      tenantId: input.tenantId, characterId: input.characterId,
    }) === true;
  } catch {
    return false;
  }
}
