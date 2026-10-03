import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
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
  characterSessionMigrationRoots,
  createPostgresAgentRunRepository,
  createPostgresCharacterSessionRepository,
  createPostgresIdentityRepository,
  createPostgresPool,
  runMigrations,
  setPolicyRevision,
  withTransaction,
} from "@masanawa/postgres";

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
    await runMigrations(pool, characterSessionMigrationRoots());
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
    const at = toInstant(new Date());
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

    const authority = createAuthorityContext({
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
