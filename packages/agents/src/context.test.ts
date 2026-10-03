import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { compileCharacterContext, type CharacterContextCompilationInput } from "./context.js";
import { emptyCharacterSessionBindings } from "./session.js";

function fixture(): CharacterContextCompilationInput {
  const at = toInstant("2026-10-03T10:00:00Z");
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"), characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
  const characterSessionId = createCanonicalId("character-session"), characterVersionId = createCanonicalId("character-version"), agentRunId = createCanonicalId("agent-run");
  return {
    at, maxCharacters: 16000, maxEvidenceItems: 10, memoryItems: [], worldEvents: [], worldIds: [],
    authority: createAuthorityContext({ tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId }, capabilities: ["agents.session.read", "agents.run.read"], scopes: [], resourceScope: { relationshipIds: [scope.relationshipId] }, policyRevision: "policy-1", approvalIds: [], delegationChain: [], issuedAt: at, requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation") }),
    session: { ...scope, schemaVersion: 1, characterSessionId, characterVersionId, bindings: emptyCharacterSessionBindings, state: "active", revision: 1, createdAt: at, updatedAt: at, expiresAt: toInstant("2026-10-03T11:00:00Z"), closedAt: null, closeReason: null, successorSessionId: null },
    run: { ...scope, schemaVersion: 1, agentRunId, characterSessionId, characterVersionId, lineage: { parentAgentRunId: null, rootAgentRunId: agentRunId, depth: 0 }, trace: { requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"), taskId: null, workflowRunId: null, operationIds: [] }, state: "running", startedAt: at, updatedAt: at, completedAt: null, failureCode: null },
    identity: { tenantId: scope.tenantId, characterId: scope.characterId, characterVersionId, versionNumber: 1, state: "published", createdAt: at, publishedAt: at, constitution: { schemaVersion: 1, displayName: "Amina", biography: "Authored biography", personality: ["Patient"], boundaries: ["Respect privacy"], disclosurePolicy: {}, languages: ["en"], expertise: [], voiceReferences: [], appearanceReferences: [] } },
  };
}
function memory(input: CharacterContextCompilationInput) {
  return { contextItemId: "item-1", text: "Remembered preference", tokenCount: 4, fusionScore: 1, provenance: { tenantId: input.session.tenantId, memoryRecordId: createCanonicalId("memory-record"), memoryRevisionId: createCanonicalId("memory-revision"), memoryType: "preference" as const, scope: { kind: "relationship" as const, relationshipId: input.session.relationshipId }, scopeKey: `relationship:${input.session.relationshipId}`, sourceContentHash: "a".repeat(64) } };
}
describe("Character context compilation", () => {
  it("pins authored Constitution and freezes transient instructions and source references", () => {
    const input = fixture(), result = compileCharacterContext(input);
    expect(result.characterVersionId).toBe(input.session.characterVersionId);
    expect(result.systemInstructions.join("\n")).toContain("Authored biography");
    expect(result.usedCharacters).toBe(result.systemInstructions.reduce((sum, text) => sum + text.length, 0));
    expect(Object.isFrozen(result.systemInstructions)).toBe(true);
    expect(Object.isFrozen(result.evidence[0])).toBe(true);
  });
  it("rejects a different published version even for the same Character", () => {
    const input = fixture();
    expect(() => compileCharacterContext({ ...input, identity: { ...input.identity, characterVersionId: createCanonicalId("character-version") } })).toThrow();
    expect(() => compileCharacterContext({ ...input, identity: { ...input.identity, state: "draft" } })).toThrow();
  });
  it("rejects mismatched runs, expired sessions and missing authority", () => {
    const input = fixture();
    expect(() => compileCharacterContext({ ...input, run: { ...input.run, characterSessionId: createCanonicalId("character-session") } })).toThrow();
    expect(() => compileCharacterContext({ ...input, at: input.session.expiresAt })).toThrow();
    expect(() => compileCharacterContext({ ...input, authority: { ...input.authority, capabilities: [] } })).toThrow();
  });
  it("composes relationship evidence once and retains durable provenance outside prompt text", () => {
    const input = fixture(), item = memory(input);
    const result = compileCharacterContext({ ...input, memoryItems: [item, item] });
    expect(result.evidence).toHaveLength(2);
    expect(result.systemInstructions.join("\n")).toContain(item.text);
    expect(result.systemInstructions.join("\n")).not.toContain(item.provenance.memoryRecordId);
  });
  it("rejects cross-relationship recall even when optional evidence would be omitted", () => {
    const input = fixture(), item = memory(input), relationshipId = createCanonicalId("relationship");
    expect(() => compileCharacterContext({ ...input, maxEvidenceItems: 0, memoryItems: [{ ...item, provenance: { ...item.provenance, scope: { kind: "relationship", relationshipId }, scopeKey: `relationship:${relationshipId}` } }] })).toThrow();
  });
  it("rejects changed provenance for a duplicate record", () => {
    const input = fixture(), item = memory(input);
    expect(() => compileCharacterContext({ ...input, memoryItems: [item, { ...item, text: "Different" }] })).toThrow();
  });
  it("keeps mandatory identity intact when evidence exceeds the configured budget", () => {
    const input = fixture(), baseline = compileCharacterContext(input);
    const result = compileCharacterContext({ ...input, maxCharacters: baseline.usedCharacters, memoryItems: [memory(input)] });
    expect(result.systemInstructions).toEqual(baseline.systemInstructions);
    expect(result.omittedEvidenceItems).toBe(1);
    expect(() => compileCharacterContext({ ...input, maxCharacters: baseline.usedCharacters - 1 })).toThrow();
  });
  it("requires explicit World admission", () => {
    expect(() => compileCharacterContext({ ...fixture(), worldIds: [createCanonicalId("world")] })).toThrow();
  });
});

it("admits only current approved public World evidence for the pinned Character", () => {
  const input = fixture(), worldId = createCanonicalId("world");
  const event = { tenantId: input.session.tenantId, worldId, worldEventId: createCanonicalId("world-event"),
    characterId: input.session.characterId, characterVersionId: input.session.characterVersionId,
    eventKind: "authored.scene", payload: { scene: "Library" }, provenance: "authored" as const,
    visibility: "public" as const, canonState: "approved" as const, occurrenceKey: null,
    effectiveStart: input.at, effectiveEnd: null, recordedAt: input.at, approvedAt: input.at, retiredAt: null };
  const admitted = { ...input, worldIds: [worldId], authority: { ...input.authority, resourceScope: { ...input.authority.resourceScope, worldIds: [worldId] } } };
  expect(compileCharacterContext({ ...admitted, worldEvents: [event] }).evidence).toHaveLength(2);
  for (const invalid of [
    { ...event, visibility: "private" as const }, { ...event, canonState: "draft" as const },
    { ...event, characterVersionId: createCanonicalId("character-version") },
    { ...event, effectiveEnd: input.at }, { ...event, payload: { relationshipId: input.session.relationshipId } },
  ]) expect(() => compileCharacterContext({ ...admitted, maxEvidenceItems: 0, worldEvents: [invalid] })).toThrow();
});

it("excludes Character-private and organization Memory until owner disclosure is wired", () => {
  const input = fixture(), item = memory(input);
  const scope = { kind: "character-private" as const, characterId: input.session.characterId };
  expect(() => compileCharacterContext({ ...input, memoryItems: [{ ...item, provenance: { ...item.provenance, scope, scopeKey: `character-private:${scope.characterId}` } }] })).toThrow();
});
