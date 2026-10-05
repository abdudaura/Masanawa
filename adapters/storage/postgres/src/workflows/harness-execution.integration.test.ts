import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPostgresPool,
  createPostgresWorkflowExecutionCheckpointReader,
  createPostgresWorkflowExecutionExternalOutcomeGuard,
  runMigrations,
} from "../index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const eventMigrations = fileURLToPath(
  new URL("../../../../../packages/events/migrations", import.meta.url),
);
const identityMigrations = fileURLToPath(
  new URL("../../../../../packages/identity/migrations", import.meta.url),
);
const securityMigrations = fileURLToPath(
  new URL("../../../../../packages/security/migrations", import.meta.url),
);
const workflowMigrations = fileURLToPath(
  new URL("../../../../../packages/workflows/migrations", import.meta.url),
);

describePostgres("canonical Harness Workflow evidence ports", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-harness-workflow-admission-test",
      max: 4,
    });
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS workflows CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS events CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS security CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );
    await runMigrations(pool, [
      { owner: "events", directory: eventMigrations },
      { owner: "identity", directory: identityMigrations },
      { owner: "security", directory: securityMigrations },
      { owner: "workflows", directory: workflowMigrations },
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns safe when no canonical Operation is bound to the Task", async () => {
    const guard = createPostgresWorkflowExecutionExternalOutcomeGuard(pool);
    const result = await guard.inspect({
      lease: {
        tenantId: createCanonicalId("tenant"),
        taskId: createCanonicalId("task"),
        workflowRunId: createCanonicalId("workflow-run"),
        workflowVersionId: createCanonicalId("workflow-version"),
        graphSignature: "sha256:" + "a".repeat(64),
        nodeKey: "research",
        state: "running",
        revision: 1,
        leaseOwner: "worker-a",
        leaseFence: 1,
        leaseExpiresAt: nowInstant(),
      },
      checkpoint: null,
      at: nowInstant(),
    });
    expect(result).toEqual({ kind: "safe" });
  });

  it("checkpoint reader returns null when no compatible checkpoint exists", async () => {
    const reader = createPostgresWorkflowExecutionCheckpointReader(pool);
    const result = await reader.loadLatestCompatible({
      tenantId: createCanonicalId("tenant"),
      workflowRunId: createCanonicalId("workflow-run"),
      workflowVersionId: createCanonicalId("workflow-version"),
      graphSignature: "sha256:" + "b".repeat(64),
      schemaVersion: 1,
    });
    expect(result).toBeNull();
  });
});
