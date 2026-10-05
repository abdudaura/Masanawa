import { fileURLToPath } from "node:url";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPostgresPool,
  createPostgresWorkflowExecutorCommitRepository,
  createPostgresWorkflowExecutorLeaseRepository,
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

describePostgres("PostgreSQL fenced Workflow commits", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-workflow-fenced-commit-test",
      max: 5,
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
    const workflowRunId = createCanonicalId("workflow-run");
    const at = nowInstant();

    await pool.query(
      "INSERT INTO identity.tenants(tenant_id,state,revision,created_at,updated_at) VALUES($1,'active',1,$2,$2)",
      [tenantId, at],
    );
    await pool.query(
      "INSERT INTO identity.users(tenant_id,user_id,state,revision,created_at,updated_at) VALUES($1,$2,'active',1,$3,$3)",
      [tenantId, userId, at],
    );
    await pool.query(
      "INSERT INTO identity.characters(tenant_id,character_id,state,revision,created_at,updated_at) VALUES($1,$2,'active',1,$3,$3)",
      [tenantId, characterId, at],
    );
    await pool.query(
      `INSERT INTO identity.relationships(
         tenant_id,relationship_id,user_id,character_id,state,revision,created_at,updated_at
       ) VALUES($1,$2,$3,$4,'active',1,$5,$5)`,
      [tenantId, relationshipId, userId, characterId, at],
    );
    await pool.query(
      "INSERT INTO security.policy_state(tenant_id,revision) VALUES($1,'fenced-v1')",
      [tenantId],
    );

    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "user", userId },
      scopes: ["workflows"],
      capabilities: [
        "workflows.run.create",
        "workflows.run.read",
        "workflows.run.update",
        "workflows.run.checkpoint",
        "workflows.run.cancel",
      ],
      resourceScope: { relationshipIds: [relationshipId] },
      policyRevision: "fenced-v1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: at,
    });
    const scope = { tenantId, userId, characterId, relationshipId };
    const runs = createPostgresWorkflowRunRepository(pool);
    const run = await runs.create({
      authority,
      run: {
        schemaVersion: 1,
        ...scope,
        workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        taskId: null,
        state: "running",
        revision: 1,
        checkpointRevision: 0,
        pendingApprovalIds: [],
        createdAt: at,
        updatedAt: at,
        completedAt: null,
        failureCode: null,
      },
    });
    return { tenantId, workflowRunId, authority, scope, run };
  }

  it("commits checkpoint only while the exact lease fence is current", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    const commits = createPostgresWorkflowExecutorCommitRepository(pool);
    const lease = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    const checkpoint = {
      schemaVersion: 1 as const,
      workflowRunId: f.workflowRunId,
      checkpointRevision: 1,
      graphSignature: "graph:fenced:v1",
      committedState: { done: ["plan"] },
      executorState: { node: "act" },
      edgeState: {},
      pendingApprovalIds: [] as const,
      createdAt: nowInstant(),
    };
    const updated = await commits.appendCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: f.run.revision,
      checkpoint,
      executor: { holderId: lease.holderId, fence: lease.fence },
    });
    expect(updated.checkpointRevision).toBe(1);

    const replay = await commits.appendCheckpoint({
      authority: f.authority,
      scope: f.scope,
      expectedRunRevision: f.run.revision,
      checkpoint,
      executor: { holderId: lease.holderId, fence: lease.fence },
    });
    expect(replay.checkpointRevision).toBe(1);
  });

  it("fences the old worker after release and takeover", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    const commits = createPostgresWorkflowExecutorCommitRepository(pool);
    const first = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    await leases.release({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: first.holderId,
      fence: first.fence,
      now: nowInstant(),
    });
    const second = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-b",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    expect(second.fence).toBe(first.fence + 1);

    await expect(
      commits.transition({
        authority: f.authority,
        scope: f.scope,
        workflowRunId: f.workflowRunId,
        expectedRevision: f.run.revision,
        to: "waiting_external",
        executor: { holderId: first.holderId, fence: first.fence },
      }),
    ).rejects.toMatchObject({ code: "workflows.executor_lease_fenced" });

    const waiting = await commits.transition({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.workflowRunId,
      expectedRevision: f.run.revision,
      to: "waiting_external",
      executor: { holderId: second.holderId, fence: second.fence },
    });
    expect(waiting.state).toBe("waiting_external");
  });

  it("revalidates current Security authority inside the fenced transaction", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    const commits = createPostgresWorkflowExecutorCommitRepository(pool);
    const lease = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    await pool.query(
      "UPDATE security.policy_state SET revision='fenced-v2', updated_at=clock_timestamp() WHERE tenant_id=$1",
      [f.tenantId],
    );

    await expect(
      commits.transition({
        authority: f.authority,
        scope: f.scope,
        workflowRunId: f.workflowRunId,
        expectedRevision: f.run.revision,
        to: "waiting_external",
        executor: { holderId: lease.holderId, fence: lease.fence },
      }),
    ).rejects.toMatchObject({ code: "authority.stale_policy" });
  });
});
