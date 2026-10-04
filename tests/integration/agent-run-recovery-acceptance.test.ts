import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  emptyCharacterSessionBindings,
  type AgentRunScope,
} from "@masanawa/agents";
import { createAuthorityContext } from "@masanawa/security";
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

describePostgres("AgentRun restart and replay acceptance", () => {
  const databaseName =
    `masanawa_agent_run_recovery_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;
  const sessionMaxMs = 3_600_000;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "agent-run-recovery-admin",
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
    databaseUrl = url.toString();
    pool = openPool("initial");

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

  function openPool(label: string) {
    return createPostgresPool({
      connectionString: databaseUrl,
      applicationName: `agent-run-recovery-${label}`,
      max: 3,
    });
  }

  async function reconnect(label: string) {
    await pool.end();
    pool = openPool(label);
    await expect(pool.query("SELECT 1 AS ready")).resolves.toMatchObject({
      rowCount: 1,
    });
  }

  async function databaseNow(): Promise<Instant> {
    const result = await pool.query<{ at: Date }>(
      "SELECT clock_timestamp() AS at",
    );
    return toInstant(result.rows[0]!.at);
  }

  async function fixture() {
    const scope: AgentRunScope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const characterVersionId = createCanonicalId("character-version");
    const at = await databaseNow();

    await withTransaction(pool, async (client) => {
      const identity = createPostgresIdentityRepository(client);
      await identity.createTenant({
        tenantId: scope.tenantId,
        createdAt: at,
      });
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
        constitution: {
          schemaVersion: 1,
          displayName: "Recovery Character",
          biography: "",
          personality: [],
          boundaries: [],
          disclosurePolicy: {},
          languages: ["en"],
          voiceReferences: [],
          appearanceReferences: [],
          expertise: [],
        },
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

    const issuedAt = await databaseNow();
    const authority = createAuthorityContext({
      issuedAt,
      tenantId: scope.tenantId,
      principal: { kind: "user", userId: scope.userId },
      scopes: [],
      capabilities: [
        "agents.session.create",
        "agents.session.read",
        "agents.run.create",
        "agents.run.read",
        "agents.run.finish",
      ],
      resourceScope: {
        relationshipIds: [scope.relationshipId],
      },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const characterSessionId = createCanonicalId("character-session");
    const sessions = createPostgresCharacterSessionRepository(pool, {
      maxDurationMs: sessionMaxMs,
    });
    await sessions.create({
      authority,
      scope,
      characterSessionId,
      characterVersionId,
      durationMs: sessionMaxMs,
      bindings: emptyCharacterSessionBindings,
    });

    return {
      scope,
      authority,
      characterSessionId,
      characterVersionId,
    };
  }

  it("preserves admission, lineage and terminal idempotency across connection recreation", async () => {
    const f = await fixture();
    const rootAgentRunId = createCanonicalId("agent-run");
    const rootRequestId = createCanonicalId("request");
    const rootCorrelationId = createCanonicalId("correlation");
    const rootInput = {
      authority: f.authority,
      scope: f.scope,
      agentRunId: rootAgentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId,
        depth: 0,
      },
      trace: {
        requestId: rootRequestId,
        correlationId: rootCorrelationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const;

    const firstRepository = createPostgresAgentRunRepository(pool);
    const createdRoot = await firstRepository.create(rootInput);
    expect(createdRoot.state).toBe("running");

    // Simulate losing the process response after durable admission. A fresh pool and
    // repository must reconcile the same request rather than insert another run.
    await reconnect("after-root-response-loss");
    const restartedRepository = createPostgresAgentRunRepository(pool);
    const replayedRoot = await restartedRepository.create(rootInput);
    expect(replayedRoot).toEqual(createdRoot);

    const childAgentRunId = createCanonicalId("agent-run");
    const childInput = {
      authority: f.authority,
      scope: f.scope,
      agentRunId: childAgentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: rootAgentRunId,
        rootAgentRunId,
        depth: 1,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: rootCorrelationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const;

    const child = await restartedRepository.create(childInput);
    expect(child.lineage).toEqual({
      parentAgentRunId: rootAgentRunId,
      rootAgentRunId,
      depth: 1,
    });

    const completed = await restartedRepository.finish({
      authority: f.authority,
      scope: f.scope,
      agentRunId: childAgentRunId,
      outcome: { state: "completed" },
    });
    expect(completed.state).toBe("completed");

    // A second process sees the exact terminal record and identical finish replay is
    // idempotent. A changed terminal claim cannot rewrite durable history.
    await reconnect("after-terminal-response-loss");
    const finalRepository = createPostgresAgentRunRepository(pool);
    await expect(
      finalRepository.finish({
        authority: f.authority,
        scope: f.scope,
        agentRunId: childAgentRunId,
        outcome: { state: "completed" },
      }),
    ).resolves.toEqual(completed);

    await expect(
      finalRepository.finish({
        authority: f.authority,
        scope: f.scope,
        agentRunId: childAgentRunId,
        outcome: {
          state: "failed",
          failureCode: "provider.timeout",
        },
      }),
    ).rejects.toMatchObject({
      code: "agents.run_conflict",
      category: "conflict",
      retryable: false,
    });

    await expect(
      finalRepository.read({
        authority: f.authority,
        scope: f.scope,
        agentRunId: rootAgentRunId,
      }),
    ).resolves.toEqual(createdRoot);
    await expect(
      finalRepository.read({
        authority: f.authority,
        scope: f.scope,
        agentRunId: childAgentRunId,
      }),
    ).resolves.toEqual(completed);
  });
});
