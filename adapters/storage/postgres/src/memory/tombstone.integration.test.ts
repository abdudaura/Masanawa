import { fileURLToPath } from "node:url";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createMemoryScopePredicate,
} from "@masanawa/memory";
import {
  createAuthorityContext,
  createPendingApproval,
} from "@masanawa/security";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  activateMemoryProjectionGeneration,
  cleanupTombstonedMemoryProjections,
  createMemoryProjectionGeneration,
  createMemoryRecord,
  createPostgresPool,
  createTenant,
  executeMemoryRecordTombstone,
  getMemoryRecordInScope,
  indexMemoryEntitySnapshot,
  indexMemoryLexicalSnapshot,
  indexMemoryTemporalSnapshot,
  indexMemoryVectorSnapshot,
  persistPendingApproval,
  prepareMemoryRecordTombstone,
  runMigrations,
  searchMemoryEntity,
  searchMemoryHybrid,
  searchMemoryLexical,
  searchMemoryTemporal,
  searchMemoryVector,
  setPolicyRevision,
  settlePendingApproval,
  withTransaction,
} from "../index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const eventMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/events/migrations", import.meta.url),
);
const securityMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/security/migrations", import.meta.url),
);
const identityMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/identity/migrations", import.meta.url),
);
const memoryMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/memory/migrations", import.meta.url),
);
const worldMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/world/migrations", import.meta.url),
);

const migrationRoots = [
  { owner: "events", directory: eventMigrationDirectory },
  { owner: "identity", directory: identityMigrationDirectory },
  { owner: "memory", directory: memoryMigrationDirectory },
  { owner: "security", directory: securityMigrationDirectory },
  { owner: "world", directory: worldMigrationDirectory },
] as const;

describePostgres("PostgreSQL memory tombstone propagation", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-memory-tombstone-integration",
      max: 4,
    });
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS world CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS memory CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS security CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS events CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );

    const applied = await runMigrations(pool, migrationRoots);
    expect(applied).toContain("memory/0006_memory_tombstones.sql");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("requires governed tombstone audit, suppresses retrieval immediately and cleans only disposable projections", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const memoryRecordId = createCanonicalId("memory-record");
    const memoryRevisionId = createCanonicalId("memory-revision");
    const bypassRecordId = createCanonicalId("memory-record");
    const bypassRevisionId = createCanonicalId("memory-revision");
    const observedAt = toInstant("2026-10-02T08:30:00Z");
    const tombstonedAt = toInstant("2026-10-02T09:00:00Z");
    const expiresAt = toInstant("2026-10-03T09:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, {
        tenantId,
        createdAt: observedAt,
      });
      await setPolicyRevision(client, tenantId, "policy-1");

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId,
        memoryRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "Orchid preference belongs to relationship alpha.",
        extractionMethod: "fixture",
        observedAt,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:tombstone:alpha",
            sourceContentHash: "a".repeat(64),
            verbatimText: "The user said they prefer orchids.",
            observedAt,
          },
        ],
        createdAt: observedAt,
      });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: bypassRecordId,
        memoryRevisionId: bypassRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "Bypass target stays active.",
        extractionMethod: "fixture",
        observedAt,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:tombstone:bypass",
            sourceContentHash: "b".repeat(64),
            observedAt,
          },
        ],
        createdAt: observedAt,
      });
    });

    const snapshot = await withTransaction(pool, async (client) => {
      const current = await getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId,
        scope: { kind: "relationship", relationshipId },
      });
      expect(current).not.toBeNull();
      return current!;
    });

    const lexicalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const vectorGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const entityGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const temporalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const builtAt = toInstant("2026-10-02T08:40:00Z");

    await withTransaction(pool, async (client) => {
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: lexicalGeneration,
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        createdAt: builtAt,
      });
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: vectorGeneration,
        kind: "vector",
        implementationKey: "postgres-pgvector-cosine-v1",
        schemaVersion: 1,
        vectorCompatibility: {
          providerKey: "fixture-provider",
          modelKey: "fixture-embed-v1",
          dimension: 3,
        },
        createdAt: builtAt,
      });
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: entityGeneration,
        kind: "entity",
        implementationKey: "postgres-entity-keys-v1",
        schemaVersion: 1,
        createdAt: builtAt,
      });
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: temporalGeneration,
        kind: "temporal",
        implementationKey: "postgres-temporal-v1",
        schemaVersion: 1,
        createdAt: builtAt,
      });

      const bypass = await getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId: bypassRecordId,
        scope: { kind: "relationship", relationshipId },
      });
      expect(bypass).not.toBeNull();

      for (const current of [snapshot, bypass!] as const) {
        await indexMemoryLexicalSnapshot(client, {
          memoryProjectionGenerationId: lexicalGeneration,
          snapshot: current,
          builtAt,
        });
        await indexMemoryVectorSnapshot(client, {
          memoryProjectionGenerationId: vectorGeneration,
          snapshot: current,
          embedding:
            current.record.memoryRecordId === memoryRecordId
              ? [1, 0, 0]
              : [0, 1, 0],
          builtAt,
        });
        await indexMemoryEntitySnapshot(client, {
          memoryProjectionGenerationId: entityGeneration,
          snapshot: current,
          entityKeys:
            current.record.memoryRecordId === memoryRecordId
              ? ["orchid"]
              : ["bypass"],
          builtAt,
        });
        await indexMemoryTemporalSnapshot(client, {
          memoryProjectionGenerationId: temporalGeneration,
          snapshot: current,
          builtAt,
        });
      }
    });

    for (const memoryProjectionGenerationId of [
      lexicalGeneration,
      vectorGeneration,
      entityGeneration,
      temporalGeneration,
    ]) {
      await activateMemoryProjectionGeneration(pool, {
        tenantId,
        memoryProjectionGenerationId,
        activatedAt: toInstant("2026-10-02T08:45:00Z"),
      });
    }

    const scopePredicate = createMemoryScopePredicate([
      { kind: "relationship", relationshipId },
    ]);
    const vectorCompatibility = {
      providerKey: "fixture-provider",
      modelKey: "fixture-embed-v1",
      dimension: 3,
    } as const;

    const before = await searchMemoryHybrid(pool, {
      tenantId,
      scopePredicate,
      lexicalQuery: "orchid",
      vector: {
        compatibility: vectorCompatibility,
        queryVector: [1, 0, 0],
      },
      entityKeys: ["orchid"],
      temporal: {
        fromInclusive: toInstant("2026-10-02T08:00:00Z"),
        toExclusive: toInstant("2026-10-02T09:00:00Z"),
      },
      limit: 10,
    });
    expect(before.map((hit) => hit.memoryRecordId)).toContain(memoryRecordId);

    await expect(
      pool.query(
        `UPDATE memory.records
            SET lifecycle_state = 'tombstoned',
                lifecycle_revision = lifecycle_revision + 1,
                updated_at = $3
          WHERE tenant_id = $1
            AND memory_record_id = $2`,
        [tenantId, bypassRecordId, tombstonedAt],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `INSERT INTO memory.record_tombstones (
           tenant_id,
           operation_id,
           memory_record_id,
           memory_revision_id,
           authority_context_id,
           approval_id,
           policy_revision,
           principal_key,
           prior_lifecycle_revision,
           tombstoned_lifecycle_revision,
           reason,
           tombstoned_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,'policy-1','system:raw-sql',1,2,$7,$8)`,
        [
          tenantId,
          createCanonicalId("operation"),
          bypassRecordId,
          bypassRevisionId,
          createCanonicalId("authority-context"),
          createCanonicalId("approval"),
          "Raw SQL audit without lifecycle transition must not commit.",
          tombstonedAt,
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const principal = {
      kind: "system",
      systemKind: "memory-tombstone-test",
    } as const;
    const baseAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["memory.record.tombstone"],
      resourceScope: { relationshipIds: [relationshipId] },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    const target = {
      tenantId,
      memoryRecordId,
      memoryRevisionId,
      scope: { kind: "relationship", relationshipId } as const,
      expectedLifecycleRevision: 1,
      reason: "User requested explicit deletion of this memory.",
    } as const;

    const prepared = await prepareMemoryRecordTombstone(pool, {
      ...target,
      authority: baseAuthority,
      idempotencyKey: "memory-tombstone-alpha-1",
      expiresAt,
    });
    expect(prepared.reused).toBe(false);

    const approval = createPendingApproval({
      kind: "once",
      binding: prepared.binding,
      policyRevision: "policy-1",
      requestedAt: observedAt,
      expiresAt,
    });
    await withTransaction(pool, async (client) => {
      await persistPendingApproval(client, approval);
      await settlePendingApproval(client, {
        tenantId,
        approvalId: approval.approvalId,
        decision: "approved",
        approverKey: "operator:memory-tombstone-test",
        decidedAt: observedAt,
      });
    });

    const executeAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["memory.record.tombstone"],
      resourceScope: { relationshipIds: [relationshipId] },
      policyRevision: "policy-1",
      approvalIds: [approval.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const executed = await executeMemoryRecordTombstone(pool, {
      ...target,
      authority: executeAuthority,
      operationId: prepared.operation.operationId,
      approvalId: approval.approvalId,
      tombstonedAt,
    });
    expect(executed.reused).toBe(false);
    expect(executed.operation.state).toBe("succeeded");
    expect(executed.record.record.lifecycleState).toBe("tombstoned");
    expect(executed.record.record.lifecycleRevision).toBe(2);
    expect(executed.tombstone.priorLifecycleRevision).toBe(1);
    expect(executed.tombstone.tombstonedLifecycleRevision).toBe(2);

    const lexical = await withTransaction(
      pool,
      (client) =>
        searchMemoryLexical(client, {
          tenantId,
          scopePredicate,
          query: "orchid",
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(lexical.map((hit) => hit.memoryRecordId)).not.toContain(
      memoryRecordId,
    );

    const vector = await withTransaction(
      pool,
      (client) =>
        searchMemoryVector(client, {
          tenantId,
          scopePredicate,
          compatibility: vectorCompatibility,
          queryVector: [1, 0, 0],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(vector.map((hit) => hit.memoryRecordId)).not.toContain(
      memoryRecordId,
    );

    const entity = await withTransaction(
      pool,
      (client) =>
        searchMemoryEntity(client, {
          tenantId,
          scopePredicate,
          entityKeys: ["orchid"],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(entity.map((hit) => hit.memoryRecordId)).not.toContain(
      memoryRecordId,
    );

    const temporal = await withTransaction(
      pool,
      (client) =>
        searchMemoryTemporal(client, {
          tenantId,
          scopePredicate,
          fromInclusive: toInstant("2026-10-02T08:00:00Z"),
          toExclusive: toInstant("2026-10-02T09:00:00Z"),
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(temporal.map((hit) => hit.memoryRecordId)).not.toContain(
      memoryRecordId,
    );

    const after = await searchMemoryHybrid(pool, {
      tenantId,
      scopePredicate,
      lexicalQuery: "orchid",
      vector: {
        compatibility: vectorCompatibility,
        queryVector: [1, 0, 0],
      },
      entityKeys: ["orchid"],
      temporal: {
        fromInclusive: toInstant("2026-10-02T08:00:00Z"),
        toExclusive: toInstant("2026-10-02T09:00:00Z"),
      },
      limit: 10,
    });
    expect(after.map((hit) => hit.memoryRecordId)).not.toContain(
      memoryRecordId,
    );

    const projectionCountsBeforeCleanup = await pool.query<{
      lexical: string;
      vector: string;
      entity: string;
      temporal: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM memory.lexical_projections
           WHERE tenant_id = $1 AND memory_record_id = $2) AS lexical,
         (SELECT count(*)::text FROM memory.vector_projections
           WHERE tenant_id = $1 AND memory_record_id = $2) AS vector,
         (SELECT count(*)::text FROM memory.entity_projections
           WHERE tenant_id = $1 AND memory_record_id = $2) AS entity,
         (SELECT count(*)::text FROM memory.temporal_projections
           WHERE tenant_id = $1 AND memory_record_id = $2) AS temporal`,
      [tenantId, memoryRecordId],
    );
    expect(projectionCountsBeforeCleanup.rows[0]).toEqual({
      lexical: "1",
      vector: "1",
      entity: "1",
      temporal: "1",
    });

    const cleanup = await withTransaction(pool, (client) =>
      cleanupTombstonedMemoryProjections(client, tenantId, memoryRecordId),
    );
    expect(cleanup).toMatchObject({
      lexicalDeleted: 1,
      vectorDeleted: 1,
      entityDeleted: 1,
      temporalDeleted: 1,
    });

    await expect(
      withTransaction(pool, (client) =>
        cleanupTombstonedMemoryProjections(
          client,
          tenantId,
          bypassRecordId,
        ),
      ),
    ).rejects.toMatchObject({
      code: "memory.projection_cleanup_not_tombstoned",
    });

    const preserved = await withTransaction(pool, (client) =>
      getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId,
        scope: { kind: "relationship", relationshipId },
      }),
    );
    expect(preserved?.record.lifecycleState).toBe("tombstoned");
    expect(preserved?.currentRevision.memoryRevisionId).toBe(memoryRevisionId);
    expect(preserved?.currentRevision.evidence[0]?.verbatimText).toBe(
      "The user said they prefer orchids.",
    );

    const persistedCounts = await pool.query<{
      revisions: string;
      evidence: string;
      projections: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM memory.revisions
           WHERE tenant_id = $1 AND memory_record_id = $2) AS revisions,
         (SELECT count(*)::text
            FROM memory.evidence e
            JOIN memory.revisions v
              ON v.tenant_id = e.tenant_id
             AND v.memory_revision_id = e.memory_revision_id
           WHERE v.tenant_id = $1
             AND v.memory_record_id = $2) AS evidence,
         (
           (SELECT count(*) FROM memory.lexical_projections
             WHERE tenant_id = $1 AND memory_record_id = $2)
           + (SELECT count(*) FROM memory.vector_projections
             WHERE tenant_id = $1 AND memory_record_id = $2)
           + (SELECT count(*) FROM memory.entity_projections
             WHERE tenant_id = $1 AND memory_record_id = $2)
           + (SELECT count(*) FROM memory.temporal_projections
             WHERE tenant_id = $1 AND memory_record_id = $2)
         )::text AS projections`,
      [tenantId, memoryRecordId],
    );
    expect(persistedCounts.rows[0]).toEqual({
      revisions: "1",
      evidence: "1",
      projections: "0",
    });

    const approvalState = await pool.query<{ state: string }>(
      `SELECT state
         FROM security.approvals
        WHERE tenant_id = $1
          AND approval_id = $2`,
      [tenantId, approval.approvalId],
    );
    expect(approvalState.rows[0]?.state).toBe("consumed");

    const replay = await executeMemoryRecordTombstone(pool, {
      ...target,
      authority: executeAuthority,
      operationId: prepared.operation.operationId,
      approvalId: approval.approvalId,
      tombstonedAt,
    });
    expect(replay.reused).toBe(true);

    await expect(
      pool.query(
        `UPDATE memory.record_tombstones
            SET reason = 'rewritten'
          WHERE tenant_id = $1
            AND memory_record_id = $2`,
        [tenantId, memoryRecordId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
