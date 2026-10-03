import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import type { PreparedSkillSelection } from "@masanawa/skills";
import { emptyCharacterSessionBindings } from "./session.js";
import type { CharacterContextCompilationInput } from "./context.js";
import { createAgentSkillSelector } from "./selection.js";
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
function selectionFixture() {
  const f = fixture(), skillVersionId = createCanonicalId("skill-version");
  const prepared: PreparedSkillSelection = Object.freeze({ revisionPin: Object.freeze({ schemaVersion: 1 as const,
    rootSkillVersionId: skillVersionId, orderedVersions: Object.freeze([]), contentHash: "fixture-pin" }),
    tools: Object.freeze([]), requiresConfirmation: false });
  const prepare = vi.fn(() => prepared);
  const policy = vi.fn(() => "policy-1"), revoked = vi.fn(() => false);
  const now = vi.fn(() => f.at);
  const selector = createAgentSkillSelector({ skills: { prepare }, currentAuthority: {
    getPolicyRevision: policy, isRevoked: revoked }, now });
  return { f, selector, prepare, policy, revoked, now,
    input: { authority: { ...f.authority, capabilities: [...f.authority.capabilities, "agents.skill.select"] }, session: { ...f.session, bindings: { ...f.session.bindings, skillVersionIds: [skillVersionId] } },
      assignment: { schemaVersion: 1 as const, tenantId: f.session.tenantId, characterId: f.session.characterId,
        skillVersionIds: [skillVersionId], revision: 1 }, run: f.run, skillVersionId, tools: [] } };
}
describe("run-bound Agent Skill selection", () => {
  it("binds selection to the exact active session, run and CharacterVersion", async () => {
    const f=selectionFixture(), result=await f.selector.prepare(f.input);
    expect(result.agentRunId).toBe(f.f.run.agentRunId);
    expect(result.characterVersionId).toBe(f.f.session.characterVersionId);
    expect(f.policy).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(result)).toBe(true);
  });
  it("denies a different session/version and terminal run before registry preparation", async () => {
    const f=selectionFixture();
    await expect(f.selector.prepare({ ...f.input, run: { ...f.input.run,
      characterVersionId: createCanonicalId("character-version") } })).rejects.toThrow();
    expect(f.prepare).not.toHaveBeenCalled();
    await expect(f.selector.prepare({ ...f.input, run: { ...f.input.run, state: "completed",
      completedAt: f.f.at } })).rejects.toThrow();
  });
  it("requires explicit selection capability and an active session", async () => {
    const f=selectionFixture();
    await expect(f.selector.prepare({ ...f.input, authority: f.f.authority })).rejects.toMatchObject({ code: "agents.selection_capability_missing" });
    await expect(f.selector.prepare({ ...f.input, session: { ...f.input.session,
      state: "closed", closedAt: f.f.at, closeReason: "ended" } })).rejects.toThrow();
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it("rejects an unassigned Skill or a Skill outside session selection", async () => {
    const f=selectionFixture();
    await expect(f.selector.prepare({ ...f.input, assignment: { ...f.input.assignment, skillVersionIds: [] } })).rejects.toThrow();
    await expect(f.selector.prepare({ ...f.input, session: f.f.session })).rejects.toThrow();
    await expect(f.selector.prepare({ ...f.input, assignment: { ...f.input.assignment,
      characterId: createCanonicalId("character") } })).rejects.toThrow();
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it("checks current authority before exposing registry data", async () => {
    const f=selectionFixture();f.policy.mockReturnValue("policy-2");
    await expect(f.selector.prepare(f.input)).rejects.toThrow();expect(f.prepare).not.toHaveBeenCalled();
  });
  it("rejects revocation after registry preparation", async () => {
    const f=selectionFixture();f.revoked.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(f.selector.prepare(f.input)).rejects.toThrow();expect(f.prepare).toHaveBeenCalledTimes(1);
  });
  it("revalidates Skill eligibility after asynchronous authority checks", async () => {
    const f=selectionFixture();f.prepare.mockImplementationOnce(() => ({
      revisionPin: { schemaVersion: 1, rootSkillVersionId: f.input.skillVersionId,
        orderedVersions: [], contentHash: "previous-pin" }, tools: [], requiresConfirmation: false }));
    await expect(f.selector.prepare(f.input)).rejects.toMatchObject({ code: "agents.selection_registry_changed" });
    expect(f.prepare).toHaveBeenCalledTimes(2);
  });
  it("rejects a session that expires during admission", async () => {
    const f=selectionFixture();f.now.mockReturnValue(f.f.session.expiresAt).mockReturnValueOnce(f.f.at);
    await expect(f.selector.prepare(f.input)).rejects.toThrow();
  });
  it("captures the principal before asynchronous authority checks", async () => {
    const f=selectionFixture(), mutable={ ...f.input, authority: { ...f.input.authority,
      principal: { ...f.input.authority.principal } } };
    const result=f.selector.prepare(mutable);Object.assign(mutable.authority.principal, { userId: createCanonicalId("user") });
    await expect(result).resolves.toMatchObject({ agentRunId: f.f.run.agentRunId });
  });
});
