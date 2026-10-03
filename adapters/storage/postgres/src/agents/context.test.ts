import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { emptyCharacterSessionBindings, type AgentRun, type CharacterSession } from "@masanawa/agents";
import { createAuthorityContext } from "@masanawa/security";
import type { Pool } from "pg";
import { createPostgresCharacterContextCompiler } from "./context.js";
import { createPostgresAgentRunRepository } from "./runs.js";

// Exercises actual owning adapters/admission through a query harness, not a PostgreSQL engine.
function fixture(options: { revoked?: boolean; stalePolicy?: boolean; archived?: boolean;
  changedRun?: boolean; expired?: boolean; newerActive?: boolean } = {}) {
  const at = toInstant("2026-10-03T10:00:00Z"), date = new Date(at);
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
  const versionId = createCanonicalId("character-version"), sessionId = createCanonicalId("character-session"), runId = createCanonicalId("agent-run");
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
    capabilities: ["agents.session.read", "agents.run.read"], scopes: [],
    resourceScope: { relationshipIds: [scope.relationshipId] }, policyRevision: "policy-1",
    approvalIds: [], delegationChain: [], issuedAt: at, requestId: run.trace.requestId, correlationId: run.trace.correlationId,
    ...(options.expired ? { expiresAt: at } : {}) });
  const commands: string[] = [], queries: { sql: string; values: unknown[] }[] = [];
  let released = 0;
  const client = {
    release() { released++; },
    async query(sql: string, values: unknown[] = []) {
      commands.push(sql); queries.push({ sql, values });
      if (/^BEGIN|^COMMIT|^ROLLBACK|^SET TRANSACTION/.test(sql)) {
        if (/READ ONLY/.test(sql)) throw new Error("Row locks cannot run in a read-only transaction");
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("clock_timestamp")) return { rows: [{ at: date }] };
      if (sql.includes("security.policy_state")) return { rows: [{ revision: options.stalePolicy ? "policy-2" : "policy-1" }] };
      if (sql.includes("security.authority_revocations")) return { rows: [], rowCount: options.revoked ? 1 : 0 };
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
