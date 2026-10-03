import { describe, expect, it } from "vitest";
import { createCanonicalId, normalizeCapabilityKey, toInstant } from "@masanawa/contracts";
import { emptyCharacterSessionBindings, type AgentRun, type CharacterSession } from "@masanawa/agents";
import { fingerprintCanonicalJson, createAuthorityContext } from "@masanawa/security";
import { memoryContextReadCapability } from "@masanawa/memory";
import { worldContextReadCapability } from "@masanawa/world";
import type { Pool } from "pg";
import { createPostgresCharacterContextCompiler } from "./context.js";
import { createPostgresAgentRunRepository } from "./runs.js";

// Exercises actual owning adapters/admission through a query harness, not a PostgreSQL engine.

import { createToolRegistry } from "@masanawa/tools";
import type { SkillVersion } from "@masanawa/skills";
import type { CapabilityKey, SkillVersionId } from "@masanawa/contracts";
import { createPostgresAgentSkillSelectionAdmission } from "./selection.js";
function skillVersion(
  key: string,
  options: {
    readonly dependencies?: readonly SkillVersionId[];
    readonly toolCapability?: CapabilityKey;
    readonly toolVersionId?: SkillVersion["toolReferences"][number]["toolVersionId"];
  } = {},
): SkillVersion {
  const capability = options.toolCapability;
  const skillVersionId = createCanonicalId("skill-version");
  return {
    skillId: createCanonicalId("skill"),
    skillVersionId,
    key,
    version: "1.0.0",
    displayName: key,
    description: `Canonical skill ${key}`,
    activationExamples: [`Use ${key}`],
    negativeActivationExamples: [`Do not use ${key}`],
    capabilities: [normalizeCapabilityKey(key)],
    requiredToolCapabilities: capability === undefined ? [] : [capability],
    toolReferences:
      capability === undefined
        ? []
        : [
            {
              referenceKey: "search",
              capability,
              toolVersionId: options.toolVersionId ?? null,
            },
          ],
    requiredAuthorityCapabilities: [],
    dependencies: options.dependencies ?? [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: "model-visible",
    riskClass: "read-only",
    sideEffectClass: "none",
    sensitivity: "public",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode: "not-required",
    reconciliationMode: "none",
    timeoutMs: 30_000,
    provenance: {
      sourceKind: "authored",
      sourceSystem: "masanawa",
      sourceReference: `skills/${key}`,
      sourceRevision: "1.0.0",
      sourceContentHash: `sha256:${"e".repeat(64)}`,
      publisher: {
        publisherKey: "masanawa",
        displayName: "Masanawa",
        kind: "first-party",
        reference: null,
      },
      trust: {
        tier: "first-party",
        evaluatorKey: "masanawa.skill-admission",
        evaluatedAt: toInstant("2026-10-02T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"3".repeat(64)}`,
      certifiedAt: toInstant("2026-10-02T00:00:00.000Z"),
      certifierKey: "masanawa.foundation",
      cases: [
        {
          caseKey: "activation.basic",
          kind: "activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/activation.basic",
          evidenceHash: `sha256:${"1".repeat(64)}`,
        },
        {
          caseKey: "negative.basic",
          kind: "negative-activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/negative.basic",
          evidenceHash: `sha256:${"2".repeat(64)}`,
        },
      ],
      testCaseCount: 2,
      passedTestCaseCount: 2,
    },
  };
}

function fixture(options: { revoked?: boolean; stalePolicy?: boolean; archived?: boolean;
  changedRun?: boolean; expired?: boolean; newerActive?: boolean; memory?: boolean; wrongMemoryScope?: boolean;
  revokedAfterMemory?: boolean; expiredAfterMemory?: boolean;
  world?: "public" | "private" | "wrong-version" | "wrong-world"; worldMissingCapability?: boolean; noAssignment?: boolean; wrongHash?: boolean; missingVersion?: boolean; disabled?: boolean; missingCapability?: boolean; unassigned?: boolean } = {}) {
  const at = toInstant("2026-10-03T10:00:00Z"), date = new Date(at);
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
  const skill = skillVersion("admission.root");
  const bindings = { ...emptyCharacterSessionBindings, skillVersionIds: [skill.skillVersionId] };
  const versionId = createCanonicalId("character-version"), sessionId = createCanonicalId("character-session"), runId = createCanonicalId("agent-run");
  const worldId = createCanonicalId("world");
  const session: CharacterSession = { ...scope, schemaVersion: 1, characterSessionId: sessionId,
    characterVersionId: versionId, bindings, state: "active", revision: 1,
    createdAt: at, updatedAt: at, expiresAt: toInstant("2026-10-03T11:00:00Z"),
    closedAt: null, closeReason: null, successorSessionId: null };
  const run: AgentRun = { ...scope, schemaVersion: 1, agentRunId: runId, characterSessionId: sessionId,
    characterVersionId: versionId, lineage: { parentAgentRunId: null, rootAgentRunId: runId, depth: 0 },
    trace: { requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"),
      taskId: null, workflowRunId: null, operationIds: [] }, state: "running", startedAt: at,
    updatedAt: at, completedAt: null, failureCode: null };
  const authority = createAuthorityContext({ tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId },
    capabilities: [...(options.missingCapability ? [] : ["agents.skill.select"]), "agents.session.read", "agents.run.read", ...(options.memory ? [memoryContextReadCapability] : []),
      ...(options.world && !options.worldMissingCapability ? [worldContextReadCapability] : [])], scopes: [],
    resourceScope: { relationshipIds: [scope.relationshipId], ...(options.world ? { worldIds: [worldId] } : {}) }, policyRevision: "policy-1",
    approvalIds: [], delegationChain: [], issuedAt: at, requestId: run.trace.requestId, correlationId: run.trace.correlationId,
    ...(options.expired ? { expiresAt: at } : {}) });
  const commands: string[] = [], queries: { sql: string; values: unknown[] }[] = [];
  let released = 0;
  let memoryRead = false;
  const client = {
    release() { released++; },
    async query(sql: string, values: unknown[] = []) {
      commands.push(sql); queries.push({ sql, values });
      if (/^BEGIN|^COMMIT|^ROLLBACK|^SET TRANSACTION/.test(sql)) {
        if (/READ ONLY/.test(sql)) throw new Error("Row locks cannot run in a read-only transaction");
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM agents.character_skill_assignments")) return { rows: options.noAssignment ? [] : [{
        tenant_id: scope.tenantId, character_id: scope.characterId, schema_version: 1,
        skill_version_ids: options.unassigned ? [] : [skill.skillVersionId], revision: "1" }] };
      if (sql.includes("FROM skills.versions")) return { rows: options.missingVersion ? [] : [{
        skill_version_id: skill.skillVersionId, definition: skill,
        definition_hash: options.wrongHash ? "0".repeat(64) : fingerprintCanonicalJson(skill) }] };
      if (sql.includes("FROM skills.readiness")) return { rows: [{ skill_version_id: skill.skillVersionId,
        state: options.disabled ? "disabled" : "ready", advertised: !options.disabled,
        reason_code: options.disabled ? "disabled" : null, checked_at: date }] };
      if (sql.startsWith("SELECT clock_timestamp")) return { rows: [{ at: options.expiredAfterMemory && memoryRead ? new Date(session.expiresAt) : date }] };
      if (sql.includes("security.policy_state")) return { rows: [{ revision: options.stalePolicy ? "policy-2" : "policy-1" }] };
      if (sql.includes("security.authority_revocations")) return { rows: [], rowCount: options.revoked || (options.revokedAfterMemory && memoryRead) ? 1 : 0 };
      if (sql.includes("FROM world.events")) return { rows: [{
        tenant_id: scope.tenantId, world_event_id: createCanonicalId("world-event"),
        world_id: options.world === "wrong-world" ? createCanonicalId("world") : worldId,
        character_id: scope.characterId, character_version_id: options.world === "wrong-version" ? createCanonicalId("character-version") : versionId,
        event_kind: "authored.scene", payload: { scene: "Public library" }, provenance: "authored",
        visibility: options.world === "private" ? "private" : "public", canon_state: "approved", occurrence_key: null,
        effective_start: date, effective_end: null, recorded_at: date, approved_at: date, retired_at: null,
      }] };
      if (sql.includes("FROM memory.lexical_projections")) { memoryRead = true; return { rows: options.memory ? [{
        tenant_id: scope.tenantId, memory_projection_generation_id: createCanonicalId("memory-projection-generation"),
        memory_record_id: createCanonicalId("memory-record"), memory_revision_id: createCanonicalId("memory-revision"),
        memory_type: "preference", scope_kind: "relationship",
        scope_ref_id: options.wrongMemoryScope ? createCanonicalId("relationship") : scope.relationshipId,
        source_content_hash: "a".repeat(64), canonical_content: "Prefers careful Hausa voice replies",
        document_text: "Prefers careful Hausa voice replies", built_at: date, lexical_rank: 0.8,
      }] : [], rowCount: options.memory ? 1 : 0 }; }
      if (sql.includes("FROM agents.character_sessions")) return { rows: [{
        tenant_id: scope.tenantId, user_id: scope.userId, character_id: scope.characterId, relationship_id: scope.relationshipId,
        character_session_id: sessionId, character_version_id: versionId, state: "active", revision: "1",
        schema_version: 1, bindings, created_at: date, updated_at: date,
        expires_at: new Date(session.expiresAt), closed_at: null, close_reason: null, successor_session_id: null,
      }] };
      if (sql.includes("FROM agents.agent_runs")) return { rows: [{
        tenant_id: scope.tenantId, user_id: scope.userId, character_id: scope.characterId, relationship_id: scope.relationshipId,
        agent_run_id: runId, character_session_id: sessionId, character_version_id: versionId,
        parent_agent_run_id: null, root_agent_run_id: runId, lineage_depth: 0,
        request_id: run.trace.requestId, correlation_id: run.trace.correlationId, task_id: null, workflow_run_id: null,
        operation_ids: [], state: options.changedRun ? "completed" : "running",
        started_at: date, updated_at: date, completed_at: options.changedRun ? date : null, failure_code: null,
      }] };
      if (sql.includes("FROM identity.tenants")) return { rows: [{ ...scope, characterVersionId: versionId,
        tenantState: "active", userState: "active", characterState: "active", relationshipState: options.archived ? "archived" : "active",
        versionState: "published", activeCharacterVersionId: options.newerActive ? createCanonicalId("character-version") : versionId }] };
      if (sql.includes("FROM identity.character_versions")) return { rows: [{
        tenant_id: scope.tenantId, character_id: scope.characterId, character_version_id: versionId,
        version_number: "1", state: "published", created_at: date, published_at: date, retired_at: null,
        constitution: { schemaVersion: 1, displayName: "Authored Amina", biography: "Pinned biography",
          personality: [], boundaries: [], disclosurePolicy: {}, languages: ["en"],
          voiceReferences: [], appearanceReferences: [], expertise: [] },
      }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  return { pool, scope, input: { authority, session, run, skillVersionId: skill.skillVersionId, tools: [] }, commands, queries, released: () => released };
}

describe("durable Skill selection admission (query harness)", () => {
  it("locks durable custody, current assignment and owning exact graph without writes", async () => {
    const f=fixture();const selection=await createPostgresAgentSkillSelectionAdmission(f.pool,createToolRegistry()).prepare(f.input);
    expect(selection.agentRunId).toBe(f.input.run.agentRunId);
    expect(selection.assignmentRevision).toBe(1);
    expect(selection.revisionPin.rootSkillVersionId).toBe(f.input.skillVersionId);
    for (const table of ["agents.character_skill_assignments","skills.versions","skills.readiness"]) {
      const query=f.queries.find(q=>q.sql.includes("FROM "+table));expect(query?.sql).toContain("FOR SHARE");
    }
    expect(f.commands.some(sql=>/INSERT|UPDATE |DELETE |READ ONLY/.test(sql))).toBe(false);
    expect(f.commands.at(-1)).toBe("COMMIT");expect(f.released()).toBe(1);
  });
  it.each([
    [{ changedRun:true },"agents.selection_snapshot_changed"],
    [{ noAssignment:true },"agents.selection_assignment_missing"],
    [{ unassigned:true },"agents.selection_binding_mismatch"],
    [{ wrongHash:true },"skill.snapshot_definition_invalid"],
    [{ missingVersion:true },"skill.selection_version_missing"],
    [{ disabled:true },"skill.selection_not_advertised"],
    [{ archived:true },"identity.interaction_unavailable"],
    [{ stalePolicy:true },"authority.stale_policy"],
    [{ revoked:true },"authority.revoked"],
  ])("rolls back denied durable selection: %j",async(options,code)=>{
    const f=fixture(options);await expect(createPostgresAgentSkillSelectionAdmission(f.pool,createToolRegistry()).prepare(f.input)).rejects.toMatchObject({code});
    expect(f.commands.at(-1)).toBe("ROLLBACK");expect(f.released()).toBe(1);
  });
  it("denies missing capability before opening a connection",async()=>{
    const f=fixture({missingCapability:true});await expect(createPostgresAgentSkillSelectionAdmission(f.pool,createToolRegistry()).prepare(f.input)).rejects.toMatchObject({code:"agents.selection_capability_missing"});
    expect(f.commands).toEqual([]);
  });
});
