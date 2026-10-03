import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { emptyCharacterSessionBindings, type AgentRun, type CharacterSession } from "@masanawa/agents";
import { createAuthorityContext } from "@masanawa/security";
import { memoryContextReadCapability } from "@masanawa/memory";
import { worldContextReadCapability } from "@masanawa/world";
import type { Pool } from "pg";
import { createPostgresCharacterContextCompiler } from "./context.js";
import { createPostgresAgentRunRepository } from "./runs.js";

// Exercises actual owning adapters/admission through a query harness, not a PostgreSQL engine.
function fixture(options: { revoked?: boolean; stalePolicy?: boolean; archived?: boolean;
  changedRun?: boolean; expired?: boolean; newerActive?: boolean; memory?: boolean; wrongMemoryScope?: boolean;
  revokedAfterMemory?: boolean; expiredAfterMemory?: boolean;
  world?: "public" | "private" | "wrong-version" | "wrong-world"; worldMissingCapability?: boolean } = {}) {
  const at = toInstant("2026-10-03T10:00:00Z"), date = new Date(at);
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
  const versionId = createCanonicalId("character-version"), sessionId = createCanonicalId("character-session"), runId = createCanonicalId("agent-run");
  const worldId = createCanonicalId("world");
  const session: CharacterSession = { ...scope, schemaVersion: 1, characterSessionId: sessionId,
    characterVersionId: versionId, bindings: emptyCharacterSessionBindings, state: "active", revision: 1,
    createdAt: at, updatedAt: at, expiresAt: toInstant("2026-10-03T11:00:00Z"),
    closedAt: null, closeReason: null, successorSessionId: null };
  const run: AgentRun = { ...scope, schemaVersion: 1, agentRunId: runId, characterSessionId: sessionId,
    characterVersionId: versionId, lineage: { parentAgentRunId: null, rootAgentRunId: runId, depth: 0 },
    trace: { requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"),
      taskId: null, workflowRunId: null, operationIds: [] }, state: "running", startedAt: at,
    updatedAt: at, completedAt: null, failureCode: null };
  const authority = createAuthorityContext({ tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId },
    capabilities: ["agents.session.read", "agents.run.read", ...(options.memory ? [memoryContextReadCapability] : []),
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
        schema_version: 1, bindings: emptyCharacterSessionBindings, created_at: date, updated_at: date,
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
  return { pool, scope, input: { authority, session, run }, commands, queries, released: () => released };
}

describe("PostgreSQL Character context admission (query harness)", () => {
  it("combines owning Identity/Memory with explicitly admitted public World evidence", async () => {
    const f = fixture({ memory: true, world: "public" });
    const context = await createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "Hausa" });
    expect(context.evidence.map(item => item.kind)).toEqual(["identity", "memory", "world"]);
    expect(context.systemInstructions.join(" ")).toContain("Public library");
    const query = f.queries.find(q => q.sql.includes("FROM world.events"))!;
    expect(query.values.slice(0, 4)).toEqual([f.scope.tenantId, f.input.authority.resourceScope.worldIds,
      f.scope.characterId, f.input.session.characterVersionId]);
    expect(query.sql).toContain("world_id = ANY($2::text[])");
    expect(query.sql).not.toContain("uuid[]");
    expect(query.sql).toContain("visibility = 'public'");
    expect(query.sql).toContain("canon_state = 'approved'");
    expect(query.sql).toContain("retired_at IS NULL");
    expect(query.sql).toContain("effective_end > $5");
    expect(query.sql).toContain("LIMIT 8");
  });

  it.each(["private", "wrong-version", "wrong-world"] as const)("rejects invalid World projection %s", async world => {
    const f = fixture({ world });
    await expect(createPostgresCharacterContextCompiler(f.pool).compile(f.input)).rejects.toMatchObject({ code: "agents.context_scope_mismatch" });
    expect(f.commands.at(-1)).toBe("ROLLBACK");
  });

  it("requires a World read capability before reading even an admitted World", async () => {
    const f = fixture({ world: "public", worldMissingCapability: true });
    await expect(createPostgresCharacterContextCompiler(f.pool).compile(f.input)).rejects.toMatchObject({ code: "world.context_access_denied" });
    expect(f.commands.some(sql => sql.includes("FROM world.events"))).toBe(false);
  });
  it("recalls only the bound Relationship through current canonical Memory projections", async () => {
    const f = fixture({ memory: true });
    const context = await createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "Hausa" });
    expect(context.systemInstructions.join(" ")).toContain("Prefers careful Hausa voice replies");
    expect(context.evidence.filter(item => item.kind === "memory")).toHaveLength(1);
    const query = f.queries.find(q => q.sql.includes("FROM memory.lexical_projections"))!;
    expect(query.values[0]).toBe(f.scope.tenantId);
    expect(JSON.parse(query.values[1] as string)).toEqual([{ scope_kind: "relationship", scope_ref_id: f.scope.relationshipId }]);
    expect(query.values.slice(2)).toEqual(["Hausa", 20]);
    expect(query.sql).toContain("r.lifecycle_state = 'active'");
    expect(query.sql).toContain("v.memory_revision_id = p.memory_revision_id");
    expect(query.sql).toContain("p.document_text = v.content");
    expect(query.sql).toContain("v.expires_at > clock_timestamp()");
    expect(f.commands.some(sql => /INSERT|UPDATE |DELETE /.test(sql))).toBe(false);
  });

  it("requires explicit recall authority before querying Memory", async () => {
    const f = fixture();
    await expect(createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "Hausa" })).rejects.toMatchObject({ code: "memory.context_capability_missing" });
    expect(f.commands.some(sql => sql.includes("FROM memory.lexical_projections"))).toBe(false);
    expect(f.commands.at(-1)).toBe("ROLLBACK");
  });

  it.each([{ revokedAfterMemory: true }, { expiredAfterMemory: true }])("rejects context when admission expires after recall: %j", async options => {
    const f = fixture({ memory: true, ...options });
    await expect(createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "Hausa" })).rejects.toThrow();
    expect(f.commands.some(sql => sql.includes("FROM memory.lexical_projections"))).toBe(true);
    expect(f.commands.at(-1)).toBe("ROLLBACK");
  });

  it("rejects an out-of-scope Memory result before supplying inference context", async () => {
    const f = fixture({ memory: true, wrongMemoryScope: true });
    await expect(createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "Hausa" })).rejects.toThrow();
    expect(f.commands.at(-1)).toBe("ROLLBACK");
  });

  it("does not retrieve for empty queries and rejects unbounded queries before acquisition", async () => {
    const f = fixture();
    await createPostgresCharacterContextCompiler(f.pool).compile({ ...f.input, recallQuery: "  " });
    expect(f.commands.some(sql => sql.includes("FROM memory.lexical_projections"))).toBe(false);
    const oversized = fixture();
    await expect(createPostgresCharacterContextCompiler(oversized.pool).compile({ ...oversized.input, recallQuery: "x".repeat(2001) })).rejects.toThrow("bound");
    expect(oversized.commands).toEqual([]);
  });
  it("uses exact owner version with current lifecycle/security locks despite newer active identity", async () => {
    const f = fixture({ newerActive: true });
    const context = await createPostgresCharacterContextCompiler(f.pool).compile(f.input);
    expect(context.characterVersionId).toBe(f.input.session.characterVersionId);
    expect(context.systemInstructions.join(" ")).toContain("Pinned biography");
    const identityQuery = f.queries.find(q => q.sql.includes("FROM identity.character_versions"));
    expect(identityQuery?.values).toEqual([f.scope.tenantId, f.scope.characterId, f.input.session.characterVersionId]);
    expect(identityQuery?.sql).toContain("FOR SHARE");
    expect(f.commands.at(-1)).toBe("COMMIT");
    expect(f.released()).toBe(1);
    expect(f.commands.some(sql => /INSERT|UPDATE |DELETE |READ ONLY/.test(sql))).toBe(false);
  });
  it.each([
    [{ revoked: true }, "authority.revoked"],
    [{ stalePolicy: true }, "authority.stale_policy"],
    [{ archived: true }, "identity.interaction_unavailable"],
    [{ changedRun: true }, "agents.context_snapshot_changed"],
    [{ expired: true }, "agents.session_access_denied"],
  ])("rolls back and releases on denied admission %j", async (options, code) => {
    const f = fixture(options);
    await expect(createPostgresCharacterContextCompiler(f.pool).compile(f.input)).rejects.toMatchObject({ code });
    expect(f.commands.at(-1)).toBe("ROLLBACK");
    expect(f.released()).toBe(1);
    expect(f.commands).not.toContain("COMMIT");
  });
  it("reads AgentRun with share locks in a writable transaction", async () => {
    const f = fixture();
    expect(await createPostgresAgentRunRepository(f.pool).read({ authority: f.input.authority,
      scope: f.scope, agentRunId: f.input.run.agentRunId })).toEqual(f.input.run);
    expect(f.commands.some(sql => sql.includes("READ ONLY"))).toBe(false);
    expect(f.commands.some(sql => sql.includes("FOR SHARE"))).toBe(true);
  });
  it("captures authority principal before waiting for a connection", async () => {
    const f = fixture();
    let connect!: (value: unknown) => void;
    const originalPool = f.pool;
    const delayedPool = { connect: () => new Promise(resolve => { connect = resolve; }) } as unknown as Pool;
    const mutable = { ...f.input, authority: { ...f.input.authority, principal: { ...f.input.authority.principal } } };
    const result = createPostgresCharacterContextCompiler(delayedPool).compile(mutable);
    Object.assign(mutable.authority.principal, { userId: createCanonicalId("user") });
    connect(await originalPool.connect());
    await expect(result).resolves.toMatchObject({ characterVersionId: f.input.session.characterVersionId });
  });
});
