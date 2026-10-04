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

  it("keeps a persisted RequestId bound to one AgentRun after restart", async () => {
    const f = await fixture();
    const requestId = createCanonicalId("request");
    const correlationId = createCanonicalId("correlation");
    const firstAgentRunId = createCanonicalId("agent-run");
    const firstInput = {
      authority: f.authority,
      scope: f.scope,
      agentRunId: firstAgentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: firstAgentRunId,
        depth: 0,
      },
      trace: {
        requestId,
        correlationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const;

    const repository = createPostgresAgentRunRepository(pool);
    const first = await repository.create(firstInput);

    await reconnect("request-id-rebind");
    const restartedRepository = createPostgresAgentRunRepository(pool);
    const secondAgentRunId = createCanonicalId("agent-run");

    await expect(
      restartedRepository.create({
        ...firstInput,
        agentRunId: secondAgentRunId,
        lineage: {
          parentAgentRunId: null,
          rootAgentRunId: secondAgentRunId,
          depth: 0,
        },
      }),
    ).rejects.toMatchObject({
      code: "agents.run_conflict",
      category: "conflict",
      retryable: false,
    });

    await expect(
      restartedRepository.read({
        authority: f.authority,
        scope: f.scope,
        agentRunId: firstAgentRunId,
      }),
    ).resolves.toEqual(first);
  });

  it("replays the exact failed terminal outcome but rejects a changed failure after restart", async () => {
    const f = await fixture();
    const agentRunId = createCanonicalId("agent-run");
    const repository = createPostgresAgentRunRepository(pool);
    await repository.create({
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
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

    const failed = await repository.finish({
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      outcome: {
        state: "failed",
        failureCode: "provider.timeout",
      },
    });
    expect(failed.state).toBe("failed");
    expect(failed.failureCode).toBe("provider.timeout");

    await reconnect("failed-terminal-replay");
    const restartedRepository = createPostgresAgentRunRepository(pool);

    await expect(
      restartedRepository.finish({
        authority: f.authority,
        scope: f.scope,
        agentRunId,
        outcome: {
          state: "failed",
          failureCode: "provider.timeout",
        },
      }),
    ).resolves.toEqual(failed);

    await expect(
      restartedRepository.finish({
        authority: f.authority,
        scope: f.scope,
        agentRunId,
        outcome: {
          state: "failed",
          failureCode: "provider.rate_limit",
        },
      }),
    ).rejects.toMatchObject({
      code: "agents.run_conflict",
      category: "conflict",
      retryable: false,
    });
  });


  it("rejects changed admission payload and forged child lineage after restart", async () => {
    const f = await fixture();
    const rootAgentRunId = createCanonicalId("agent-run");
    const requestId = createCanonicalId("request");
    const correlationId = createCanonicalId("correlation");
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
        requestId,
        correlationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const;

    const repository = createPostgresAgentRunRepository(pool);
    const root = await repository.create(rootInput);

    await reconnect("changed-admission");
    const restartedRepository = createPostgresAgentRunRepository(pool);

    await expect(
      restartedRepository.create({
        ...rootInput,
        trace: {
          ...rootInput.trace,
          correlationId: createCanonicalId("correlation"),
        },
      }),
    ).rejects.toMatchObject({
      code: "agents.run_conflict",
      category: "conflict",
      retryable: false,
    });

    const childAgentRunId = createCanonicalId("agent-run");
    const unrelatedParentId = createCanonicalId("agent-run");
    await expect(
      restartedRepository.create({
        authority: f.authority,
        scope: f.scope,
        agentRunId: childAgentRunId,
        characterSessionId: f.characterSessionId,
        characterVersionId: f.characterVersionId,
        lineage: {
          parentAgentRunId: unrelatedParentId,
          rootAgentRunId,
          depth: 1,
        },
        trace: {
          requestId: createCanonicalId("request"),
          correlationId,
          taskId: null,
          workflowRunId: null,
          operationIds: [],
        },
      }),
    ).rejects.toMatchObject({
      code: "agents.run_conflict",
      category: "conflict",
      retryable: false,
    });

    await expect(
      restartedRepository.read({
        authority: f.authority,
        scope: f.scope,
        agentRunId: rootAgentRunId,
      }),
    ).resolves.toEqual(root);
  });


  it("admits one durable result when identical AgentRun requests race across repositories", async () => {
    const f = await fixture();
    const agentRunId = createCanonicalId("agent-run");
    const input = {
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
        depth: 0,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const;

    const poolA = openPool("race-identical-a");
    const poolB = openPool("race-identical-b");
    try {
      const repoA = createPostgresAgentRunRepository(poolA);
      const repoB = createPostgresAgentRunRepository(poolB);
      const [a, b] = await Promise.all([
        repoA.create(input),
        repoB.create(input),
      ]);
      expect(a).toEqual(b);

      const count = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM agents.agent_runs WHERE tenant_id = $1 AND agent_run_id = $2",
        [f.scope.tenantId, agentRunId],
      );
      expect(count.rows[0]!.count).toBe("1");
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });

  it("allows only one AgentRun when different runs race for the same RequestId", async () => {
    const f = await fixture();
    const requestId = createCanonicalId("request");
    const correlationId = createCanonicalId("correlation");
    const firstId = createCanonicalId("agent-run");
    const secondId = createCanonicalId("agent-run");

    const makeInput = (agentRunId: typeof firstId) => ({
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
        depth: 0,
      },
      trace: {
        requestId,
        correlationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
    } as const);

    const poolA = openPool("race-request-a");
    const poolB = openPool("race-request-b");
    try {
      const results = await Promise.allSettled([
        createPostgresAgentRunRepository(poolA).create(makeInput(firstId)),
        createPostgresAgentRunRepository(poolB).create(makeInput(secondId)),
      ]);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<ReturnType<typeof createPostgresAgentRunRepository>["create"]>>> =>
          result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toMatchObject({
        code: "agents.run_conflict",
        category: "conflict",
        retryable: false,
      });

      const rows = await pool.query<{ agent_run_id: string }>(
        "SELECT agent_run_id FROM agents.agent_runs WHERE tenant_id = $1 AND request_id = $2",
        [f.scope.tenantId, requestId],
      );
      expect(rows.rows).toHaveLength(1);
      expect([firstId, secondId]).toContain(rows.rows[0]!.agent_run_id);
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });

  it("preserves scoped Task Workflow and Operation trace references across restart", async () => {
    const f = await fixture();
    const taskId = createCanonicalId("task");
    const workflowRunId = createCanonicalId("workflow-run");
    const operationIds = [
      createCanonicalId("operation"),
      createCanonicalId("operation"),
    ] as const;
    const authority = {
      ...f.authority,
      resourceScope: {
        ...f.authority.resourceScope,
        taskIds: [taskId],
        workflowRunIds: [workflowRunId],
      },
    };
    const agentRunId = createCanonicalId("agent-run");
    const input = {
      authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
        depth: 0,
      },
      trace: {
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId,
        workflowRunId,
        operationIds,
      },
    } as const;

    const created = await createPostgresAgentRunRepository(pool).create(input);
    expect(created.trace.taskId).toBe(taskId);
    expect(created.trace.workflowRunId).toBe(workflowRunId);
    expect(new Set(created.trace.operationIds)).toEqual(new Set(operationIds));

    await reconnect("trace-references");
    const repository = createPostgresAgentRunRepository(pool);
    await expect(
      repository.read({
        authority,
        scope: f.scope,
        agentRunId,
      }),
    ).resolves.toEqual(created);

    await expect(
      repository.read({
        authority: f.authority,
        scope: f.scope,
        agentRunId,
      }),
    ).rejects.toMatchObject({
      code: "agents.run_access_denied",
      category: "authorization",
      retryable: false,
    });

    await expect(
      pool.query(
        "UPDATE agents.agent_runs SET operation_ids = '[]'::jsonb WHERE tenant_id = $1 AND agent_run_id = $2",
        [f.scope.tenantId, agentRunId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("keeps the admitted CharacterVersion pinned after a newer version activates and the process restarts", async () => {
    const f = await fixture();
    const agentRunId = createCanonicalId("agent-run");
    const repository = createPostgresAgentRunRepository(pool);
    const created = await repository.create({
      authority: f.authority,
      scope: f.scope,
      agentRunId,
      characterSessionId: f.characterSessionId,
      characterVersionId: f.characterVersionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: agentRunId,
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

    const newerVersionId = createCanonicalId("character-version");
    const at = await databaseNow();
    await withTransaction(pool, async (client) => {
      const identity = createPostgresIdentityRepository(client);
      await identity.createCharacterVersion({
        tenantId: f.scope.tenantId,
        characterVersionId: newerVersionId,
        characterId: f.scope.characterId,
        versionNumber: 2,
        constitution: {
          schemaVersion: 1,
          displayName: "Recovery Character v2",
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
        tenantId: f.scope.tenantId,
        characterVersionId: newerVersionId,
        publishedAt: at,
      });
      await identity.activateCharacterVersion({
        tenantId: f.scope.tenantId,
        characterId: f.scope.characterId,
        characterVersionId: newerVersionId,
        expectedCharacterRevision: 2,
        activatedAt: at,
      });
    });

    await reconnect("new-character-version");
    const restarted = createPostgresAgentRunRepository(pool);
    const recovered = await restarted.read({
      authority: f.authority,
      scope: f.scope,
      agentRunId,
    });
    expect(recovered.characterVersionId).toBe(f.characterVersionId);
    expect(recovered).toEqual(created);
  });

});
