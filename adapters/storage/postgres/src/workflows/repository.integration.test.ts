import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import type { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  createPostgresPool,
  createPostgresTaskRepository,
  createPostgresWorkflowRunRepository,
  runMigrations,
} from "../index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const identityMigrations = fileURLToPath(
  new URL("../../../../../packages/identity/migrations", import.meta.url),
);
const securityMigrations = fileURLToPath(
  new URL("../../../../../packages/security/migrations", import.meta.url),
);
const workflowMigrations = fileURLToPath(
  new URL("../../../../../packages/workflows/migrations", import.meta.url),
);

describePostgres("PostgreSQL Work persistence", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-workflows-integration",
      max: 4,
    });
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS workflows CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS security CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );

    await runMigrations(pool, [
      { owner: "identity", directory: identityMigrations },
      { owner: "security", directory: securityMigrations },
      { owner: "workflows", directory: workflowMigrations },
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function fixture() {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const relationshipId = createCanonicalId("relationship");
    const at = nowInstant();

    await pool.query(
      `INSERT INTO identity.tenants(
         tenant_id, state, revision, created_at, updated_at
       ) VALUES($1,'active',1,$2,$2)`,
      [tenantId, at],
    );
    await pool.query(
      `INSERT INTO identity.users(
         tenant_id, user_id, state, revision, created_at, updated_at
       ) VALUES($1,$2,'active',1,$3,$3)`,
      [tenantId, userId, at],
    );
    await pool.query(
      `INSERT INTO identity.characters(
         tenant_id, character_id, state, revision, created_at, updated_at
       ) VALUES($1,$2,'active',1,$3,$3)`,
      [tenantId, characterId, at],
    );
    await pool.query(
      `INSERT INTO identity.relationships(
         tenant_id, relationship_id, user_id, character_id, state,
         revision, created_at, updated_at
       ) VALUES($1,$2,$3,$4,'active',1,$5,$5)`,
      [tenantId, relationshipId, userId, characterId, at],
    );
    await pool.query(
      `INSERT INTO security.policy_state(tenant_id, revision)
       VALUES($1,'work-test-v1')`,
      [tenantId],
    );

    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "user", userId },
      scopes: ["workflows"],
      capabilities: [
        "workflows.task.create",
        "workflows.task.read",
        "workflows.task.update",
        "workflows.task.cancel",
        "workflows.run.create",
        "workflows.run.read",
        "workflows.run.update",
        "workflows.run.checkpoint",
        "workflows.run.cancel",
      ],
      resourceScope: { relationshipIds: [relationshipId] },
      policyRevision: "work-test-v1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: at,
    });

    return {
      at,
      authority,
      scope: { tenantId, userId, characterId, relationshipId },
    };
  }

  it("persists Task and WorkflowRun state across repository instances", async () => {
    const f = await fixture();
    const tasks = createPostgresTaskRepository(pool);
    const runs = createPostgresWorkflowRunRepository(pool);
    const taskId = createCanonicalId("task");

    const createdTask = await tasks.create({
      authority: f.authority,
      task: {
        schemaVersion: 1,
        ...f.scope,
        taskId,
        title: "Compare solar options",
        state: "queued",
        workflowRunId: null,
        revision: 1,
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const runningTask = await tasks.transition({
      authority: f.authority,
      scope: f.scope,
      taskId,
      expectedRevision: createdTask.revision,
      to: "running",
      updatedAt: nowInstant(),
    });

    const workflowRunId = createCanonicalId("workflow-run");
    const run = await runs.create({
      authority: f.authority,
      run: {
        schemaVersion: 1,
        ...f.scope,
        workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        taskId,
        state: "running",
        revision: 1,
        checkpointRevision: 0,
        pendingApprovalIds: [],
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });

    await tasks.transition({
      authority: f.authority,
      scope: f.scope,
      taskId,
      expectedRevision: runningTask.revision,
      to: "waiting_external",
      workflowRunId,
      updatedAt: nowInstant(),
    });

    await runs.appendCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: run.revision,
      checkpoint: {
        schemaVersion: 1,
        workflowRunId,
        checkpointRevision: 1,
        graphSignature: "graph:test:v1",
        committedState: { selectedPlan: "basic" },
        executorState: { node: "compare" },
        edgeState: { completed: ["start"] },
        pendingApprovalIds: [],
        createdAt: nowInstant(),
      },
    });

    const afterRestartTasks = createPostgresTaskRepository(pool);
    const afterRestartRuns = createPostgresWorkflowRunRepository(pool);

    const restoredTask = await afterRestartTasks.read({
      authority: f.authority,
      scope: f.scope,
      taskId,
    });
    const restoredRun = await afterRestartRuns.read({
      authority: f.authority,
      scope: f.scope,
      workflowRunId,
    });
    const checkpoint = await afterRestartRuns.readLatestCheckpoint({
      authority: f.authority,
      scope: f.scope,
      workflowRunId,
    });

    expect(restoredTask.state).toBe("waiting_external");
    expect(restoredTask.workflowRunId).toBe(workflowRunId);
    expect(restoredRun.checkpointRevision).toBe(1);
    expect(restoredRun.revision).toBe(2);
    expect(checkpoint?.graphSignature).toBe("graph:test:v1");
    expect(checkpoint?.committedState).toEqual({ selectedPlan: "basic" });
  });

  it("rejects stale revisions and terminal restart", async () => {
    const f = await fixture();
    const tasks = createPostgresTaskRepository(pool);
    const taskId = createCanonicalId("task");

    const created = await tasks.create({
      authority: f.authority,
      task: {
        schemaVersion: 1,
        ...f.scope,
        taskId,
        title: "Prepare report",
        state: "queued",
        workflowRunId: null,
        revision: 1,
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const running = await tasks.transition({
      authority: f.authority,
      scope: f.scope,
      taskId,
      expectedRevision: created.revision,
      to: "running",
      updatedAt: nowInstant(),
    });

    await expect(
      tasks.transition({
        authority: f.authority,
        scope: f.scope,
        taskId,
        expectedRevision: created.revision,
        to: "failed",
        failureCode: "work.stale",
        updatedAt: nowInstant(),
      }),
    ).rejects.toMatchObject({ code: "workflows.task_conflict" });

    const completed = await tasks.transition({
      authority: f.authority,
      scope: f.scope,
      taskId,
      expectedRevision: running.revision,
      to: "completed",
      updatedAt: nowInstant(),
    });
    await expect(
      tasks.transition({
        authority: f.authority,
        scope: f.scope,
        taskId,
        expectedRevision: completed.revision,
        to: "running",
        updatedAt: nowInstant(),
      }),
    ).rejects.toMatchObject({ code: "workflows.task_transition_invalid" });
  });

  it("replays an identical checkpoint but rejects conflicting state", async () => {
    const f = await fixture();
    const tasks = createPostgresTaskRepository(pool);
    const runs = createPostgresWorkflowRunRepository(pool);
    const taskId = createCanonicalId("task");
    await tasks.create({
      authority: f.authority,
      task: {
        schemaVersion: 1,
        ...f.scope,
        taskId,
        title: "Research suppliers",
        state: "running",
        workflowRunId: null,
        revision: 1,
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const workflowRunId = createCanonicalId("workflow-run");
    const run = await runs.create({
      authority: f.authority,
      run: {
        schemaVersion: 1,
        ...f.scope,
        workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        taskId,
        state: "running",
        revision: 1,
        checkpointRevision: 0,
        pendingApprovalIds: [],
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const checkpoint = {
      schemaVersion: 1 as const,
      workflowRunId,
      checkpointRevision: 1,
      graphSignature: "graph:suppliers:v1",
      committedState: { suppliers: ["a"] },
      executorState: { node: "rank" },
      edgeState: { completed: ["search"] },
      pendingApprovalIds: [] as const,
      createdAt: nowInstant(),
    };

    const first = await runs.appendCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: run.revision,
      checkpoint,
    });
    const replay = await runs.appendCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: run.revision,
      checkpoint,
    });
    expect(replay.checkpointRevision).toBe(first.checkpointRevision);

    await expect(
      runs.appendCheckpoint({
        authority: f.authority,
        scope: f.scope,
        expectedRunRevision: first.revision,
        checkpoint: {
          ...checkpoint,
          committedState: { suppliers: ["different"] },
        },
      }),
    ).rejects.toMatchObject({ code: "workflows.checkpoint_conflict" });
  });

  it("atomically commits a checkpoint with an approval wait transition", async () => {
    const f = await fixture();
    const tasks = createPostgresTaskRepository(pool);
    const runs = createPostgresWorkflowRunRepository(pool);
    const taskId = createCanonicalId("task");
    await tasks.create({
      authority: f.authority,
      task: {
        schemaVersion: 1,
        ...f.scope,
        taskId,
        title: "Approve purchase",
        state: "running",
        workflowRunId: null,
        revision: 1,
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const workflowRunId = createCanonicalId("workflow-run");
    const run = await runs.create({
      authority: f.authority,
      run: {
        schemaVersion: 1,
        ...f.scope,
        workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        taskId,
        state: "running",
        revision: 1,
        checkpointRevision: 0,
        pendingApprovalIds: [],
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });
    const approvalId = createCanonicalId("approval");
    const checkpoint = {
      schemaVersion: 1 as const,
      workflowRunId,
      checkpointRevision: 1,
      graphSignature: "graph:approval:v1",
      committedState: { quote: "ready" },
      executorState: { currentNodeId: "purchase", stepCount: 1 },
      edgeState: {},
      pendingApprovalIds: [approvalId],
      createdAt: nowInstant(),
    };

    const paused = await runs.commitCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: run.revision,
      checkpoint,
      transition: {
        to: "waiting_approval",
        pendingApprovalIds: [approvalId],
      },
    });

    expect(paused.state).toBe("waiting_approval");
    expect(paused.checkpointRevision).toBe(1);
    expect(paused.pendingApprovalIds).toEqual([approvalId]);

    const restored = await createPostgresWorkflowRunRepository(pool).read({
      authority: f.authority,
      scope: f.scope,
      workflowRunId,
    });
    const restoredCheckpoint =
        await createPostgresWorkflowRunRepository(pool).readLatestCheckpoint({
      authority: f.authority,
      scope: f.scope,
      workflowRunId,
    });
    expect(restored.state).toBe("waiting_approval");
    expect(restoredCheckpoint?.pendingApprovalIds).toEqual([approvalId]);
    expect(restoredCheckpoint?.committedState).toEqual({ quote: "ready" });
  });

  it("revalidates current policy before reads and transitions", async () => {
    const f = await fixture();
    const tasks = createPostgresTaskRepository(pool);
    const taskId = createCanonicalId("task");
    await tasks.create({
      authority: f.authority,
      task: {
        schemaVersion: 1,
        ...f.scope,
        taskId,
        title: "Policy sensitive work",
        state: "queued",
        workflowRunId: null,
        revision: 1,
        createdAt: f.at,
        updatedAt: f.at,
        completedAt: null,
        failureCode: null,
      },
    });

    await pool.query(
      `UPDATE security.policy_state
          SET revision = 'work-test-v2', updated_at = clock_timestamp()
        WHERE tenant_id = $1`,
      [f.scope.tenantId],
    );

    await expect(
      tasks.read({
        authority: f.authority,
        scope: f.scope,
        taskId,
      }),
    ).rejects.toMatchObject({ code: "authority.stale_policy" });
  });
});
