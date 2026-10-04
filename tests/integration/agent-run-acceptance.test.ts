import { createToolRegistry } from "@masanawa/tools";
import type { SkillVersion } from "@masanawa/skills";
import type { CapabilityKey, SkillVersionId } from "@masanawa/contracts";
import { approveWorldEvent } from "../../adapters/storage/postgres/src/world/repository.js";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  normalizeCapabilityKey,
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
} from "@masanawa/security";
import {
  emptyCharacterSessionBindings,
  type CharacterSessionScope,
} from "@masanawa/agents";
import {
  appendWorldEvent,
  createWorld,
  activateMemoryProjectionGeneration,
  createMemoryProjectionGeneration,
  createMemoryRecord,
  getMemoryRecordInScope,
  indexMemoryLexicalSnapshot,
  characterSessionMigrationRoots,
  createPostgresAgentSkillSelectionAdmission,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresSkillRepository,
  createPostgresAgentRunRepository,
  createPostgresCharacterContextCompiler,
  createPostgresCharacterSessionRepository,
  createPostgresIdentityRepository,
  createPostgresPool,
  runMigrations,
  setPolicyRevision,
  withTransaction,
} from "@masanawa/postgres";

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

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("AgentRun PostgreSQL 18 acceptance", () => {
  const databaseName =
    `masanawa_agent_runs_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let created = false;
  const sessionMaxMs = 3_600_000;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "agent-runs-acceptance-admin",
      max: 1,
    });
    const version = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(
      180000,
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeLessThan(190000);
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = createPostgresPool({
      connectionString: url.toString(),
      applicationName: "agent-runs-acceptance",
      max: 5,
    });
  });

  beforeEach(async () => {
    for (const schema of [
      "memory",
      "world",
      "agents",
      "identity",
      "skills",
      "security",
      "events",
    ]) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations",
    );
    await runMigrations(pool, [...characterSessionMigrationRoots(),
      { owner: "memory", directory: fileURLToPath(new URL("../../packages/memory/migrations", import.meta.url)) },
      { owner: "world", directory: fileURLToPath(new URL("../../packages/world/migrations", import.meta.url)) },
    ]);
  });

  afterAll(async () => {
    try {
      await pool?.end();
      if (created) {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
          [databaseName],
        );
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally {
      await admin?.end();
    }
  });

  async function fixture() {
    const scope: CharacterSessionScope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const characterVersionId = createCanonicalId("character-version");
    const at = toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at);
    const constitution = {
      schemaVersion: 1,
      displayName: "Amina",
      biography: "",
      personality: [],
      boundaries: [],
      disclosurePolicy: {},
      languages: ["en"],
      voiceReferences: [],
      appearanceReferences: [],
      expertise: [],
    } as const;

    await withTransaction(pool, async (client) => {
      const identity = createPostgresIdentityRepository(client);
      await identity.createTenant({ tenantId: scope.tenantId, createdAt: at });
      await identity.createUser({
        tenantId: scope.tenantId,
        userId: scope.userId,
        createdAt: at,
      });
      await identity.createCharacter({
        tenantId: scope.tenantId,
        characterId: scope.characterId,
        createdAt: at,
      });
      await identity.createCharacterVersion({
        tenantId: scope.tenantId,
        characterVersionId,
        characterId: scope.characterId,
        versionNumber: 1,
        constitution,
        createdAt: at,
      });
      await identity.publishCharacterVersion({
        tenantId: scope.tenantId,
        characterVersionId,
        publishedAt: at,
      });
      await identity.activateCharacterVersion({
        tenantId: scope.tenantId,
        characterId: scope.characterId,
        characterVersionId,
        expectedCharacterRevision: 1,
        activatedAt: at,
      });
      await identity.getOrCreateRelationship({
        ...scope,
        createdAt: at,
      });
      await setPolicyRevision(client, scope.tenantId, "policy-1");
    });

    // Admission uses the database clock; fixtures must not assume synchronized hosts.
    const issuedAt = toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at);
    const authority = createAuthorityContext({
      issuedAt,
      tenantId: scope.tenantId,
      principal: { kind: "user", userId: scope.userId },
      scopes: [],
      capabilities: [
        "agents.session.create",
        "agents.session.read",
        "agents.session.close",
        "agents.run.create",
        "agents.run.read",
        "agents.run.finish",
      ],
      resourceScope: { relationshipIds: [scope.relationshipId] },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const sessionId = createCanonicalId("character-session");
    const sessions = createPostgresCharacterSessionRepository(pool, {
      maxDurationMs: sessionMaxMs,
    });
    await sessions.create({
      authority,
      scope,
      characterSessionId: sessionId,
      characterVersionId,
      durationMs: sessionMaxMs,
      bindings: emptyCharacterSessionBindings,
    });

    return { scope, characterVersionId, authority, sessionId };
  }

  async function contextFixture() {
    const f = await fixture();
    const runs = createPostgresAgentRunRepository(pool);
    const agentRunId = createCanonicalId("agent-run");
    const run = await runs.create({ authority: f.authority, scope: f.scope, agentRunId,
      characterSessionId: f.sessionId, characterVersionId: f.characterVersionId,
      lineage: { parentAgentRunId: null, rootAgentRunId: agentRunId, depth: 0 },
      trace: { requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"),
        taskId: null, workflowRunId: null, operationIds: [] } });
    const sessions = createPostgresCharacterSessionRepository(pool, { maxDurationMs: sessionMaxMs });
    const session = await sessions.read({ authority: f.authority, scope: f.scope, characterSessionId: f.sessionId });
    return { ...f, runs, sessions, run, session, compiler: createPostgresCharacterContextCompiler(pool) };
  }

  it("recalls indexed canonical Memory only from the session Relationship", async () => {
    const f = await contextFixture();
    const at = toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at);
    const generation = createCanonicalId("memory-projection-generation");
    const otherRelationship = createCanonicalId("relationship");
    await withTransaction(pool, async client => {
      await createMemoryProjectionGeneration(client, { tenantId: f.scope.tenantId,
        memoryProjectionGenerationId: generation, kind: "lexical",
        implementationKey: "postgres-simple-tsvector", schemaVersion: 1, createdAt: at });
      for (const [relationshipId, content] of [
        [f.scope.relationshipId, "Nebula means careful Hausa voice replies."],
        [otherRelationship, "Nebula is another Relationship secret."],
      ] as const) {
        const memoryRecordId = createCanonicalId("memory-record");
        const scope = { kind: "relationship" as const, relationshipId };
        await createMemoryRecord(client, { tenantId: f.scope.tenantId, memoryRecordId,
          memoryRevisionId: createCanonicalId("memory-revision"), memoryType: "fact",
          scope, content, extractionMethod: "acceptance-fixture", observedAt: at,
          evidence: [{ sourceKind: "message", sourceReference: "acceptance:memory",
            sourceContentHash: "a".repeat(64), observedAt: at }], createdAt: at });
        const snapshot = await getMemoryRecordInScope(client, { tenantId: f.scope.tenantId,
          memoryRecordId, scope });
        if (!snapshot) throw new Error("Canonical Memory fixture missing");
        await indexMemoryLexicalSnapshot(client, {
          memoryProjectionGenerationId: generation, snapshot, builtAt: at });
      }
    });
    await activateMemoryProjectionGeneration(pool, { tenantId: f.scope.tenantId,
      memoryProjectionGenerationId: generation, activatedAt: at });
    const authority = { ...f.authority,
      capabilities: [...f.authority.capabilities, "memory.context.read"] };
    const context = await f.compiler.compile({ authority, session: f.session,
      run: f.run, recallQuery: "Nebula" });
    expect(context.evidence.map(item => item.kind)).toEqual(["identity", "memory"]);
    expect(JSON.stringify(context)).toContain("careful Hausa voice replies");
    expect(JSON.stringify(context)).not.toContain("another Relationship secret");
    expect(await f.runs.read({ authority, scope: f.scope, agentRunId: f.run.agentRunId })).toEqual(f.run);
    await expect(f.compiler.compile({ authority: f.authority, session: f.session,
      run: f.run, recallQuery: "Nebula" })).rejects.toMatchObject({ code: "memory.context_capability_missing" });
  });

  it("admits only approved public events from explicitly scoped Worlds", async () => {
    const f = await contextFixture();
    const at = toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at);
    const worldId = createCanonicalId("world");
    const otherWorldId = createCanonicalId("world");
    await withTransaction(pool, async client => {
      for (const id of [worldId, otherWorldId]) {
        await createWorld(client, { tenantId: f.scope.tenantId, worldId: id,
          initialGenerationId: createCanonicalId("world-generation"),
          policy: { schemaVersion: 1, catchUpMode: "manual", maxCatchUpSteps: 1,
            spatialEnabled: false, automaticCanonEnabled: false },
          simulationTime: at, createdAt: at });
      }
      for (const scenario of [
        { worldId, visibility: "public", approved: true, scene: "Public library approved" },
        { worldId, visibility: "private", approved: true, scene: "Private secret forbidden" },
        { worldId, visibility: "public", approved: false, scene: "Unapproved draft forbidden" },
        { worldId: otherWorldId, visibility: "public", approved: true, scene: "Other World forbidden" },
      ] as const) {
        const worldEventId = createCanonicalId("world-event");
        await appendWorldEvent(client, { tenantId: f.scope.tenantId, worldEventId,
          worldId: scenario.worldId, characterId: f.scope.characterId,
          characterVersionId: f.characterVersionId, eventKind: "authored.scene",
          payload: { scene: scenario.scene }, provenance: "authored",
          visibility: scenario.visibility, occurrenceKey: null, admission: "draft",
          effectiveStart: at, effectiveEnd: null, recordedAt: at });
        if (scenario.approved) await approveWorldEvent(client, {
          tenantId: f.scope.tenantId, worldEventId, approvedAt: at });
      }
    });
    const authority = { ...f.authority,
      capabilities: [...f.authority.capabilities, "world.context.read"],
      resourceScope: { ...f.authority.resourceScope, worldIds: [worldId] } };
    const context = await f.compiler.compile({ authority, session: f.session, run: f.run });
    expect(context.evidence.map(item => item.kind)).toEqual(["identity", "world"]);
    expect(JSON.stringify(context)).toContain("Public library approved");
    expect(JSON.stringify(context)).not.toContain("forbidden");
    const noWorldScope = await f.compiler.compile({ authority: f.authority,
      session: f.session, run: f.run });
    expect(noWorldScope.evidence.map(item => item.kind)).toEqual(["identity"]);
    await expect(f.compiler.compile({ authority: { ...authority,
      capabilities: f.authority.capabilities }, session: f.session, run: f.run }))
      .rejects.toMatchObject({ code: "world.context_access_denied" });
  });

  it("admits current exact Skill selection and rejects changed assignment/readiness", async () => {
    const f=await contextFixture(), skill=skillVersion("acceptance.selection");
    const at=toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at), skills=createPostgresSkillRepository(pool);
    await skills.registerBatch([skill]);
    await skills.putReadiness({readiness:{skillVersionId:skill.skillVersionId,state:"ready",
      advertised:true,reasonCode:null,checkedAt:at},expectedRevision:null});
    const assignments=createPostgresCharacterSkillAssignmentRepository(pool);
    const assignment={schemaVersion:1 as const,tenantId:f.scope.tenantId,characterId:f.scope.characterId,
      skillVersionIds:[skill.skillVersionId],revision:1};
    await assignments.put({assignment,expectedRevision:null});
    const authority={...f.authority,capabilities:[...f.authority.capabilities,"agents.session.update","agents.skill.select"]};
    const session=await f.sessions.updateBindings({authority,scope:f.scope,characterSessionId:f.sessionId,
      expectedRevision:f.session.revision,bindings:{...f.session.bindings,skillVersionIds:[skill.skillVersionId]}});
    const selector=createPostgresAgentSkillSelectionAdmission(pool,createToolRegistry());
    const input={authority,session,run:f.run,skillVersionId:skill.skillVersionId,tools:[]};
    expect((await selector.prepare(input)).revisionPin.rootSkillVersionId).toBe(skill.skillVersionId);
    await skills.putReadiness({readiness:{skillVersionId:skill.skillVersionId,state:"disabled",
      advertised:false,reasonCode:"acceptance.disabled",checkedAt:at},expectedRevision:1});
    await expect(selector.prepare(input)).rejects.toMatchObject({code:"skill.selection_not_advertised"});
    await assignments.put({assignment:{...assignment,skillVersionIds:[],revision:2},expectedRevision:1});
    await expect(selector.prepare(input)).rejects.toMatchObject({code:"agents.selection_binding_mismatch"});
    expect(await f.runs.read({authority,scope:f.scope,agentRunId:f.run.agentRunId})).toEqual(f.run);
  });

  it("loads exact Constitution after a newer version becomes active without mutating run history", async () => {
    const f = await contextFixture();
    const newerId = createCanonicalId("character-version"), at = toInstant((await pool.query<{ at: Date }>("SELECT clock_timestamp() AS at")).rows[0]!.at);
    await withTransaction(pool, async client => {
      const identity = createPostgresIdentityRepository(client);
      await identity.createCharacterVersion({ tenantId: f.scope.tenantId, characterId: f.scope.characterId,
        characterVersionId: newerId, versionNumber: 2, createdAt: at,
        constitution: { schemaVersion: 1, displayName: "New identity", biography: "NEW VERSION ONLY",
          personality: [], boundaries: [], disclosurePolicy: {}, languages: ["en"],
          voiceReferences: [], appearanceReferences: [], expertise: [] } });
      await identity.publishCharacterVersion({ tenantId: f.scope.tenantId, characterVersionId: newerId, publishedAt: at });
      await identity.activateCharacterVersion({ tenantId: f.scope.tenantId, characterId: f.scope.characterId,
        characterVersionId: newerId, expectedCharacterRevision: 2, activatedAt: at });
    });
    const context = await f.compiler.compile({ authority: f.authority, session: f.session, run: f.run });
    expect(context.characterVersionId).toBe(f.characterVersionId);
    expect(context.systemInstructions.join(" ")).toContain("Amina");
    expect(context.systemInstructions.join(" ")).not.toContain("NEW VERSION ONLY");
    expect(context.evidence).toHaveLength(1);
    expect(await f.runs.read({ authority: f.authority, scope: f.scope, agentRunId: f.run.agentRunId })).toEqual(f.run);
  });

  it("denies stale run snapshots and changed policy before context reaches inference", async () => {
    const f = await contextFixture();
    await f.runs.finish({ authority: f.authority, scope: f.scope, agentRunId: f.run.agentRunId,
      outcome: { state: "completed" } });
    await expect(f.compiler.compile({ authority: f.authority, session: f.session, run: f.run })).rejects.toMatchObject({ code: "agents.context_snapshot_changed" });
    await withTransaction(pool, client => setPolicyRevision(client, f.scope.tenantId, "policy-2"));
    await expect(f.compiler.compile({ authority: f.authority, session: f.session, run: f.run })).rejects.toThrow();
  });

  it("denies closed sessions and archived Relationships at context admission", async () => {
    const f = await contextFixture();
    await f.sessions.close({ authority: f.authority, scope: f.scope, characterSessionId: f.sessionId,
      expectedRevision: f.session.revision });
    await expect(f.compiler.compile({ authority: f.authority, session: f.session, run: f.run })).rejects.toMatchObject({ code: "agents.context_snapshot_changed" });
    await pool.query("UPDATE identity.relationships SET state = 'archived', revision = revision + 1 WHERE tenant_id = $1 AND relationship_id = $2",
      [f.scope.tenantId, f.scope.relationshipId]);
    await expect(f.compiler.compile({ authority: f.authority, session: f.session, run: f.run })).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
  });

  it("persists root/child lineage, terminal state and immutable trace history", async () => {
    const f = await fixture();
    const runs = createPostgresAgentRunRepository(pool);

    const rootId = createCanonicalId("agent-run");
    const root = await runs.create({
      authority: f.authority,
      scope: f.scope,
      agentRunId: rootId,
      characterSessionId: f.sessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: rootId,
        depth: 0,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    });

    expect(root).toMatchObject({
      state: "running",
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: rootId,
        depth: 0,
      },
    });

    const childId = createCanonicalId("agent-run");
    const child = await runs.create({
      authority: f.authority,
      scope: f.scope,
      agentRunId: childId,
      characterSessionId: f.sessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: rootId,
        rootAgentRunId: rootId,
        depth: 1,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: root.trace.correlationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    });
    expect(child.lineage).toEqual({
      parentAgentRunId: rootId,
      rootAgentRunId: rootId,
      depth: 1,
    });

    const completed = await runs.finish({
      authority: f.authority,
      scope: f.scope,
      agentRunId: rootId,
      outcome: { state: "completed" },
    });
    expect(completed.state).toBe("completed");
    expect(completed.completedAt).toBe(completed.updatedAt);
    expect(await runs.read({
      authority: f.authority,
      scope: f.scope,
      agentRunId: rootId,
    })).toEqual(completed);

    await expect(
      pool.query(
        "UPDATE agents.agent_runs SET correlation_id = $2 WHERE agent_run_id = $1",
        [rootId, createCanonicalId("correlation")],
      ),
    ).rejects.toThrow(/immutable/u);

    await expect(
      pool.query(
        "DELETE FROM agents.agent_runs WHERE agent_run_id = $1",
        [childId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("rejects invalid lineage and cross-Relationship reads", async () => {
    const f = await fixture();
    const runs = createPostgresAgentRunRepository(pool);
    const rootId = createCanonicalId("agent-run");
    await runs.create({
      authority: f.authority,
      scope: f.scope,
      agentRunId: rootId,
      characterSessionId: f.sessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: rootId,
        depth: 0,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    });

    const badChildId = createCanonicalId("agent-run");
    await expect(
      runs.create({
        authority: f.authority,
        scope: f.scope,
        agentRunId: badChildId,
        characterSessionId: f.sessionId,
        characterVersionId: f.characterVersionId,
        lineage: {
          parentAgentRunId: rootId,
          rootAgentRunId: createCanonicalId("agent-run"),
          depth: 1,
        },
        trace: {
          requestId: createCanonicalId("request"),
          correlationId: createCanonicalId("correlation"),
          taskId: null,
          workflowRunId: null,
          operationIds: [],
        },
      }),
    ).rejects.toMatchObject({ code: "agents.run_conflict" });

    await expect(
      runs.read({
        authority: f.authority,
        scope: {
          ...f.scope,
          relationshipId: createCanonicalId("relationship"),
        },
        agentRunId: rootId,
      }),
    ).rejects.toMatchObject({ code: "agents.run_access_denied" });
  });
  it("reconciles exact replay after session closure and rejects changed/request-reused admissions", async () => {
    const f = await fixture();
    const runs = createPostgresAgentRunRepository(pool);
    const sessions = createPostgresCharacterSessionRepository(pool, {
      maxDurationMs: sessionMaxMs,
    });
    const agentRunId = createCanonicalId("agent-run");
    const trace = {
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      taskId: null,
      workflowRunId: null,
      operationIds: [],
    } as const;
    const input = {
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.sessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
        depth: 0,
      },
      trace,
    } as const;

    const first = await runs.create(input);
    await sessions.close({
      authority: f.authority,
      scope: f.scope,
      characterSessionId: f.sessionId,
      expectedRevision: 1,
    });

    expect(await runs.create(input)).toEqual(first);

    await expect(
      runs.create({
        ...input,
        characterVersionId: createCanonicalId("character-version"),
      }),
    ).rejects.toMatchObject({ code: "agents.run_conflict" });

    const secondRunId = createCanonicalId("agent-run");
    await expect(
      runs.create({
        ...input,
        agentRunId: secondRunId,
        lineage: {
          parentAgentRunId: null,
          rootAgentRunId: secondRunId,
          depth: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "agents.run_conflict" });
  });

});
