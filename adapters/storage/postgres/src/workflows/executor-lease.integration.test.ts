import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPostgresPool,
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

describePostgres("PostgreSQL Workflow executor lease persistence", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-workflow-executor-lease-test",
      max: 6,
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

  async function fixture(state: "queued" | "running" = "running") {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const relationshipId = createCanonicalId("relationship");
    const workflowRunId = createCanonicalId("workflow-run");
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
      "INSERT INTO security.policy_state(tenant_id, revision) VALUES($1,'lease-test-v1')",
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
      ],
      resourceScope: { relationshipIds: [relationshipId] },
      policyRevision: "lease-test-v1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: at,
    });
    const scope = { tenantId, userId, characterId, relationshipId };
    const runs = createPostgresWorkflowRunRepository(pool);
    await runs.create({
      authority,
      run: {
        schemaVersion: 1,
        ...scope,
        workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        taskId: null,
        state,
        revision: 1,
        checkpointRevision: 0,
        pendingApprovalIds: [],
        createdAt: at,
        updatedAt: at,
        completedAt: null,
        failureCode: null,
      },
    });
    return { tenantId, workflowRunId, authority, scope, runs };
  }

  it("persists lease and fence across repository recreation", async () => {
    const f = await fixture();
    const firstRepo = createPostgresWorkflowExecutorLeaseRepository(pool);
    const first = await firstRepo.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    expect(first.fence).toBe(1);

    const afterRestart = createPostgresWorkflowExecutorLeaseRepository(pool);
    const restored = await afterRestart.read({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
    });
    expect(restored).toEqual(first);
  });

  it("keeps active same-holder acquire idempotent without extending expiry", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    const first = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    const replay = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 60_000,
    });
    expect(replay).toEqual(first);
  });

  it("rejects a competing active holder", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    await expect(
      leases.acquire({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-b",
        runState: "running",
        now: nowInstant(),
        durationMs: 30_000,
      }),
    ).rejects.toMatchObject({ code: "workflows.executor_lease_held" });
  });

  it("release preserves fence and next holder increments it", async () => {
    const f = await fixture();
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);
    const first = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    const released = await leases.release({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-a",
      fence: first.fence,
      now: nowInstant(),
    });
    expect(released.state).toBe("released");
    expect(released.fence).toBe(1);

    const second = await leases.acquire({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
      holderId: "worker-b",
      runState: "running",
      now: nowInstant(),
      durationMs: 30_000,
    });
    expect(second.fence).toBe(2);
    expect(second.holderId).toBe("worker-b");

    await expect(
      leases.release({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-a",
        fence: 1,
        now: nowInstant(),
      }),
    ).rejects.toMatchObject({ code: "workflows.executor_lease_fenced" });
  });

  it("rejects stale caller WorkflowRun state and terminal acquisition", async () => {
    const f = await fixture("queued");
    const leases = createPostgresWorkflowExecutorLeaseRepository(pool);

    await expect(
      leases.acquire({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-a",
        runState: "running",
        now: nowInstant(),
        durationMs: 30_000,
      }),
    ).rejects.toMatchObject({
      code: "workflows.executor_lease_run_state_stale",
    });

    const running = await f.runs.transition({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.workflowRunId,
      expectedRevision: 1,
      to: "running",
      updatedAt: nowInstant(),
    });
    await f.runs.transition({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.workflowRunId,
      expectedRevision: running.revision,
      to: "completed",
      updatedAt: nowInstant(),
    });

    await expect(
      leases.acquire({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-a",
        runState: "completed",
        now: nowInstant(),
        durationMs: 30_000,
      }),
    ).rejects.toMatchObject({ code: "workflows.executor_lease_terminal" });
  });

  it("serializes concurrent contenders so only one holder wins", async () => {
    const f = await fixture();
    const a = createPostgresWorkflowExecutorLeaseRepository(pool);
    const b = createPostgresWorkflowExecutorLeaseRepository(pool);

    const results = await Promise.allSettled([
      a.acquire({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-a",
        runState: "running",
        now: nowInstant(),
        durationMs: 30_000,
      }),
      b.acquire({
        tenantId: f.tenantId,
        workflowRunId: f.workflowRunId,
        holderId: "worker-b",
        runState: "running",
        now: nowInstant(),
        durationMs: 30_000,
      }),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);

    const stored = await a.read({
      tenantId: f.tenantId,
      workflowRunId: f.workflowRunId,
    });
    expect(stored?.fence).toBe(1);
    expect(["worker-a", "worker-b"]).toContain(stored?.holderId);
  });
});
