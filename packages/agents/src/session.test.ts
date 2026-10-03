import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import {
  assertCharacterSessionAccess, assertCharacterSessionDuration, emptyCharacterSessionBindings,
  isCharacterSessionOpen, normalizeCharacterSession, normalizeCharacterSessionBindings,
  type CharacterSession, type CharacterSessionScope,
} from "./index.js";

const at = toInstant("2026-10-03T10:00:00Z");
function fixture() {
  const scope: CharacterSessionScope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
  const record: CharacterSession = { ...scope, schemaVersion: 1,
    characterSessionId: createCanonicalId("character-session"), characterVersionId: createCanonicalId("character-version"),
    bindings: emptyCharacterSessionBindings, state: "active", revision: 1, createdAt: at, updatedAt: at,
    expiresAt: toInstant("2026-10-03T11:00:00Z"), closedAt: null, closeReason: null, successorSessionId: null };
  const authority = createAuthorityContext({ tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId },
    capabilities: ["agents.session.read"], scopes: [], resourceScope: { relationshipIds: [scope.relationshipId] },
    policyRevision: "policy-1", approvalIds: [], delegationChain: [], issuedAt: at,
    requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation") });
  return { scope, record, authority };
}
describe("canonical CharacterSession", () => {
  it("copies and freezes bounded exact references independently of caller mutations", () => {
    const skills = [createCanonicalId("skill-version")];
    const original = { ...fixture().record, bindings: { ...emptyCharacterSessionBindings, skillVersionIds: skills } };
    const normalized = normalizeCharacterSession(original);
    skills.push(createCanonicalId("skill-version"));
    expect(normalized.bindings.skillVersionIds).toHaveLength(1);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.bindings)).toBe(true);
    expect(Object.isFrozen(normalized.bindings.skillVersionIds)).toBe(true);
  });
  it("rejects provider threads, private payloads, unknown schemas and confused canonical identifiers", () => {
    const { record } = fixture();
    expect(() => normalizeCharacterSession({ ...record, schemaVersion: 2 } as unknown as CharacterSession)).toThrow();
    expect(() => normalizeCharacterSession({ ...record, prompt: "private" } as CharacterSession)).toThrow();
    expect(() => normalizeCharacterSessionBindings({ ...emptyCharacterSessionBindings, channelSessionId: "provider-thread" } as never)).toThrow();
    expect(() => normalizeCharacterSessionBindings({ ...emptyCharacterSessionBindings, grant: "tools.send" } as never)).toThrow();
    expect(() => normalizeCharacterSession({ ...record, characterSessionId: createCanonicalId("relationship") } as never)).toThrow();
  });
  it("rejects duplicate/oversized references and unstable revisions", () => {
    const id = createCanonicalId("skill-version");
    expect(() => normalizeCharacterSessionBindings({ ...emptyCharacterSessionBindings, skillVersionIds: [id, id] })).toThrow();
    expect(() => normalizeCharacterSessionBindings({ ...emptyCharacterSessionBindings,
      taskIds: Array.from({ length: 65 }, () => createCanonicalId("task")) })).toThrow();
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, NaN]) {
      expect(() => normalizeCharacterSession({ ...fixture().record, revision })).toThrow();
    }
  });
  it("uses configured duration and treats expiry as a boundary without rewriting identity", () => {
    expect(() => assertCharacterSessionDuration(1000, 1000)).not.toThrow();
    for (const duration of [0, 1001, 0.5, Infinity]) expect(() => assertCharacterSessionDuration(duration, 1000)).toThrow();
    const record = normalizeCharacterSession(fixture().record);
    expect(isCharacterSessionOpen(record, at)).toBe(true);
    expect(isCharacterSessionOpen(record, record.expiresAt)).toBe(false);
    expect(isCharacterSessionOpen(record, toInstant("2026-10-03T09:00:00Z"))).toBe(false);
    expect(record.state).toBe("active");
  });
  it("requires a terminal reason and successor only for reset, without reopening a closed session", () => {
    const { record } = fixture();
    const terminal = normalizeCharacterSession({ ...record, state: "closed", revision: 2, closedAt: at, closeReason: "ended" });
    expect(isCharacterSessionOpen(terminal, at)).toBe(false);
    expect(() => normalizeCharacterSession({ ...terminal, closeReason: "reset" })).toThrow();
    expect(() => normalizeCharacterSession({ ...terminal, successorSessionId: record.characterSessionId })).toThrow();
    expect(() => normalizeCharacterSession({ ...record, closedAt: at })).toThrow();
    expect(() => normalizeCharacterSession({ ...record, expiresAt: at })).toThrow();
  });
  it("requires exact tenant, owner, relationship and action even when the session is visible", () => {
    const { scope, authority } = fixture();
    expect(() => assertCharacterSessionAccess(authority, scope, "read", emptyCharacterSessionBindings, at)).not.toThrow();
    for (const denied of [
      { ...authority, tenantId: createCanonicalId("tenant") },
      { ...authority, principal: { kind: "user" as const, userId: createCanonicalId("user") } },
      { ...authority, resourceScope: {} }, { ...authority, capabilities: [] },
      { ...authority, expiresAt: at }, { ...authority, issuedAt: toInstant("2026-10-03T12:00:00Z") },
    ]) expect(() => assertCharacterSessionAccess(denied, scope, "read", emptyCharacterSessionBindings, at)).toThrow();
    expect(() => assertCharacterSessionAccess(authority, scope, "update", emptyCharacterSessionBindings, at)).toThrow();
  });
  it("requires explicit other-user authority for services/operators and scoped task references", () => {
    const { scope, authority } = fixture();
    const service = { ...authority, principal: { kind: "service" as const, serviceId: createCanonicalId("service") } };
    expect(() => assertCharacterSessionAccess(service, scope, "read", emptyCharacterSessionBindings, at)).toThrow();
    expect(() => assertCharacterSessionAccess({ ...service, capabilities: [...service.capabilities, "agents.session.manage-other"] }, scope, "read", emptyCharacterSessionBindings, at)).not.toThrow();
    const taskId = createCanonicalId("task"), workflowRunId = createCanonicalId("workflow-run");
    const bindings = { ...emptyCharacterSessionBindings, taskIds: [taskId], workflowRunIds: [workflowRunId] };
    expect(() => assertCharacterSessionAccess(authority, scope, "read", bindings, at)).toThrow();
    expect(() => assertCharacterSessionAccess({ ...authority, resourceScope: { ...authority.resourceScope, taskIds: [taskId], workflowRunIds: [workflowRunId] } }, scope, "read", bindings, at)).not.toThrow();
  });
});
