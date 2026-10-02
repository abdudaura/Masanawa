import { fileURLToPath } from "node:url";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createMemoryScopePredicate } from "@masanawa/memory";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  activateMemoryProjectionGeneration,
  appendMemoryRevision,
  createMemoryProjectionGeneration,
  createMemoryRecord,
  createPostgresPool,
  getMemoryRecordInScope,
  indexMemoryEntitySnapshot,
  indexMemoryTemporalSnapshot,
  indexMemoryVectorSnapshot,
  runMigrations,
  searchMemoryEntity,
  searchMemoryTemporal,
  searchMemoryVector,
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

describePostgres("PostgreSQL multisignal memory retrieval conformance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-memory-multisignal-integration",
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
    expect(applied).toContain(
      "memory/0005_memory_multisignal_projections.sql",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("keeps vector, entity and temporal retrieval inside explicit Relationship scopes and suppresses stale revisions", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const recordA = createCanonicalId("memory-record");
    const recordB = createCanonicalId("memory-record");
    const revisionA1 = createCanonicalId("memory-revision");
    const revisionB1 = createCanonicalId("memory-revision");
    const createdAt = toInstant("2026-10-02T08:00:00Z");

    await withTransaction(pool, async (client) => {
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: recordA,
        memoryRevisionId: revisionA1,
        memoryType: "event",
        scope: { kind: "relationship", relationshipId: relationshipA },
        content: "Amina visited Katsina for relationship alpha.",
        extractionMethod: "fixture",
        eventTime: toInstant("2026-09-30T10:00:00Z"),
        observedAt: toInstant("2026-09-30T10:05:00Z"),
        validFrom: toInstant("2026-09-30T10:00:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:alpha:signal:1",
            sourceContentHash: "1".repeat(64),
            observedAt: toInstant("2026-09-30T10:05:00Z"),
          },
        ],
        createdAt,
      });
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: recordB,
        memoryRevisionId: revisionB1,
        memoryType: "event",
        scope: { kind: "relationship", relationshipId: relationshipB },
        content: "Amina visited Kano for relationship beta.",
        extractionMethod: "fixture",
        eventTime: toInstant("2026-09-30T11:00:00Z"),
        observedAt: toInstant("2026-09-30T11:05:00Z"),
        validFrom: toInstant("2026-09-30T11:00:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:beta:signal:1",
            sourceContentHash: "2".repeat(64),
            observedAt: toInstant("2026-09-30T11:05:00Z"),
          },
        ],
        createdAt,
      });
    });

    const loadSnapshots = () =>
      withTransaction(pool, async (client) => {
        const alpha = await getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: recordA,
          scope: { kind: "relationship", relationshipId: relationshipA },
        });
        const beta = await getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: recordB,
          scope: { kind: "relationship", relationshipId: relationshipB },
        });
        expect(alpha).not.toBeNull();
        expect(beta).not.toBeNull();
        return { alpha: alpha!, beta: beta! };
      });

    const snapshots = await loadSnapshots();
    const vectorGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const entityGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const temporalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const builtAt = toInstant("2026-10-02T08:10:00Z");

    await withTransaction(pool, async (client) => {
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

      await indexMemoryVectorSnapshot(client, {
        memoryProjectionGenerationId: vectorGeneration,
        snapshot: snapshots.alpha,
        embedding: [1, 0, 0],
        builtAt,
      });
      await indexMemoryEntitySnapshot(client, {
        memoryProjectionGenerationId: entityGeneration,
        snapshot: snapshots.alpha,
        entityKeys: ["Amina Bello", "Katsina"],
        builtAt,
      });
      await indexMemoryTemporalSnapshot(client, {
        memoryProjectionGenerationId: temporalGeneration,
        snapshot: snapshots.alpha,
        builtAt,
      });
    });

    await expect(
      activateMemoryProjectionGeneration(pool, {
        tenantId,
        memoryProjectionGenerationId: vectorGeneration,
        activatedAt: toInstant("2026-10-02T08:11:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "memory.projection_generation_incomplete",
    });

    await withTransaction(pool, async (client) => {
      await indexMemoryVectorSnapshot(client, {
        memoryProjectionGenerationId: vectorGeneration,
        snapshot: snapshots.beta,
        embedding: [0.98, 0.02, 0],
        builtAt,
      });
      await indexMemoryEntitySnapshot(client, {
        memoryProjectionGenerationId: entityGeneration,
        snapshot: snapshots.beta,
        entityKeys: ["amina bello", "Kano"],
        builtAt,
      });
      await indexMemoryTemporalSnapshot(client, {
        memoryProjectionGenerationId: temporalGeneration,
        snapshot: snapshots.beta,
        builtAt,
      });
    });

    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: vectorGeneration,
      activatedAt: toInstant("2026-10-02T08:12:00Z"),
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: entityGeneration,
      activatedAt: toInstant("2026-10-02T08:12:01Z"),
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: temporalGeneration,
      activatedAt: toInstant("2026-10-02T08:12:02Z"),
    });

    const alphaScope = createMemoryScopePredicate([
      { kind: "relationship", relationshipId: relationshipA },
    ]);
    const betaScope = createMemoryScopePredicate([
      { kind: "relationship", relationshipId: relationshipB },
    ]);
    const vectorCompatibility = {
      providerKey: "fixture-provider",
      modelKey: "fixture-embed-v1",
      dimension: 3,
    } as const;

    const alphaVector = await withTransaction(
      pool,
      (client) =>
        searchMemoryVector(client, {
          tenantId,
          scopePredicate: alphaScope,
          compatibility: vectorCompatibility,
          queryVector: [1, 0, 0],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(alphaVector.map((hit) => hit.memoryRecordId)).toEqual([recordA]);

    const betaVector = await withTransaction(
      pool,
      (client) =>
        searchMemoryVector(client, {
          tenantId,
          scopePredicate: betaScope,
          compatibility: vectorCompatibility,
          queryVector: [1, 0, 0],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(betaVector.map((hit) => hit.memoryRecordId)).toEqual([recordB]);

    await expect(
      withTransaction(
        pool,
        (client) =>
          searchMemoryVector(client, {
            tenantId,
            scopePredicate: alphaScope,
            compatibility: {
              providerKey: "fixture-provider",
              modelKey: "fixture-embed-v2",
              dimension: 3,
            },
            queryVector: [1, 0, 0],
            limit: 10,
          }),
        { readOnly: true },
      ),
    ).rejects.toMatchObject({ code: "memory.vector_query_incompatible" });

    const alphaEntity = await withTransaction(
      pool,
      (client) =>
        searchMemoryEntity(client, {
          tenantId,
          scopePredicate: alphaScope,
          entityKeys: ["AMINA BELLO"],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(alphaEntity.map((hit) => hit.memoryRecordId)).toEqual([recordA]);
    expect(alphaEntity[0]?.matchedEntityKeys).toEqual(["amina bello"]);

    const betaEntity = await withTransaction(
      pool,
      (client) =>
        searchMemoryEntity(client, {
          tenantId,
          scopePredicate: betaScope,
          entityKeys: ["amina bello"],
          limit: 10,
        }),
      { readOnly: true },
    );
    expect(betaEntity.map((hit) => hit.memoryRecordId)).toEqual([recordB]);

    const temporalInput = {
      tenantId,
      fromInclusive: toInstant("2026-09-30T00:00:00Z"),
      toExclusive: toInstant("2026-10-01T00:00:00Z"),
      asOf: toInstant("2026-09-30T12:00:00Z"),
      limit: 10,
    } as const;

    const alphaTemporal = await withTransaction(
      pool,
      (client) =>
        searchMemoryTemporal(client, {
          ...temporalInput,
          scopePredicate: alphaScope,
        }),
      { readOnly: true },
    );
    expect(alphaTemporal.map((hit) => hit.memoryRecordId)).toEqual([recordA]);

    const betaTemporal = await withTransaction(
      pool,
      (client) =>
        searchMemoryTemporal(client, {
          ...temporalInput,
          scopePredicate: betaScope,
        }),
      { readOnly: true },
    );
    expect(betaTemporal.map((hit) => hit.memoryRecordId)).toEqual([recordB]);

    const badVectorGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    await withTransaction(pool, (client) =>
      createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: badVectorGeneration,
        kind: "vector",
        implementationKey: "postgres-pgvector-cosine-v1",
        schemaVersion: 1,
        vectorCompatibility: {
          providerKey: "fixture-provider",
          modelKey: "fixture-embed-v1",
          dimension: 3,
        },
        createdAt: toInstant("2026-10-02T08:13:00Z"),
      }),
    );
    await expect(
      pool.query(
        `INSERT INTO memory.vector_projections (
           tenant_id,
           memory_projection_generation_id,
           memory_record_id,
           memory_revision_id,
           memory_type,
           scope_kind,
           scope_ref_id,
           source_content_hash,
           embedding,
           built_at
         )
         VALUES ($1,$2,$3,$4,'event','relationship',$5,$6,'[1,0]'::vector,$7)`,
        [
          tenantId,
          badVectorGeneration,
          recordA,
          revisionA1,
          relationshipA,
          "a".repeat(64),
          toInstant("2026-10-02T08:13:00Z"),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const revisionA2 = createCanonicalId("memory-revision");
    await withTransaction(pool, (client) =>
      appendMemoryRevision(client, {
        tenantId,
        memoryRecordId: recordA,
        memoryRevisionId: revisionA2,
        expectedRevision: 1,
        content: "Amina later visited Abuja for relationship alpha.",
        extractionMethod: "fixture",
        eventTime: toInstant("2026-10-01T14:00:00Z"),
        observedAt: toInstant("2026-10-01T14:05:00Z"),
        validFrom: toInstant("2026-10-01T14:00:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:alpha:signal:2",
            sourceContentHash: "3".repeat(64),
            observedAt: toInstant("2026-10-01T14:05:00Z"),
          },
        ],
        updatedAt: toInstant("2026-10-02T08:14:00Z"),
      }),
    );

    expect(
      await withTransaction(
        pool,
        (client) =>
          searchMemoryVector(client, {
            tenantId,
            scopePredicate: alphaScope,
            compatibility: vectorCompatibility,
            queryVector: [1, 0, 0],
            limit: 10,
          }),
        { readOnly: true },
      ),
    ).toEqual([]);

    expect(
      await withTransaction(
        pool,
        (client) =>
          searchMemoryEntity(client, {
            tenantId,
            scopePredicate: alphaScope,
            entityKeys: ["amina bello"],
            limit: 10,
          }),
        { readOnly: true },
      ),
    ).toEqual([]);

    expect(
      await withTransaction(
        pool,
        (client) =>
          searchMemoryTemporal(client, {
            ...temporalInput,
            scopePredicate: alphaScope,
          }),
        { readOnly: true },
      ),
    ).toEqual([]);
  });
});
