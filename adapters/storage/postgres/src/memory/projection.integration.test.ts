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
  getCurrentMemoryProjectionGeneration,
  getMemoryRecordInScope,
  indexMemoryLexicalSnapshot,
  runMigrations,
  searchMemoryLexical,
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

describePostgres("PostgreSQL memory retrieval projection conformance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-memory-projection-integration",
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
      "memory/0004_memory_retrieval_projections.sql",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("keeps lexical retrieval authorization-first across rebuilds and canonical revision drift", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const recordA = createCanonicalId("memory-record");
    const recordB = createCanonicalId("memory-record");
    const revisionA1 = createCanonicalId("memory-revision");
    const revisionB1 = createCanonicalId("memory-revision");
    const now = toInstant("2026-10-02T07:00:00Z");

    await withTransaction(pool, async (client) => {
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: recordA,
        memoryRevisionId: revisionA1,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId: relationshipA },
        content: "Nebula preference belongs only to relationship alpha.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:alpha:1",
            sourceContentHash: "a".repeat(64),
            observedAt: now,
          },
        ],
        createdAt: now,
      });
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: recordB,
        memoryRevisionId: revisionB1,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId: relationshipB },
        content: "Nebula preference belongs only to relationship beta.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:beta:1",
            sourceContentHash: "b".repeat(64),
            observedAt: now,
          },
        ],
        createdAt: now,
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

    const firstSnapshots = await loadSnapshots();
    const generation1 = createCanonicalId("memory-projection-generation");
    await withTransaction(pool, async (client) => {
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: generation1,
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        createdAt: now,
      });
      const first = await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation1,
        snapshot: firstSnapshots.alpha,
        builtAt: now,
      });
      expect(first.reused).toBe(false);
      expect(first.sourceContentHash).toHaveLength(64);
      const replay = await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation1,
        snapshot: firstSnapshots.alpha,
        builtAt: now,
      });
      expect(replay.reused).toBe(true);
      await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation1,
        snapshot: firstSnapshots.beta,
        builtAt: now,
      });
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: generation1,
      activatedAt: now,
    });

    const searchRelationship = (relationshipId: typeof relationshipA, query: string) =>
      withTransaction(
        pool,
        (client) =>
          searchMemoryLexical(client, {
            tenantId,
            scopePredicate: createMemoryScopePredicate([
              { kind: "relationship", relationshipId },
            ]),
            query,
            limit: 10,
          }),
        { readOnly: true },
      );

    const alphaHits = await searchRelationship(relationshipA, "nebula");
    expect(alphaHits.map((hit) => hit.memoryRecordId)).toEqual([recordA]);
    expect(alphaHits[0]?.content).toContain("relationship alpha");

    const betaHits = await searchRelationship(relationshipB, "nebula");
    expect(betaHits.map((hit) => hit.memoryRecordId)).toEqual([recordB]);

    const tamperGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    await withTransaction(pool, (client) =>
      createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: tamperGeneration,
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        createdAt: now,
      }),
    );
    await expect(
      pool.query(
        `INSERT INTO memory.lexical_projections (
           tenant_id,
           memory_projection_generation_id,
           memory_record_id,
           memory_revision_id,
           memory_type,
           scope_kind,
           scope_ref_id,
           source_content_hash,
           document_text,
           built_at
         )
         VALUES ($1,$2,$3,$4,'fact','relationship',$5,$6,$7,$8)`,
        [
          tenantId,
          tamperGeneration,
          recordA,
          revisionA1,
          relationshipA,
          "f".repeat(64),
          "Forged projection text that is not canonical.",
          now,
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const generation2 = createCanonicalId("memory-projection-generation");
    await withTransaction(pool, async (client) => {
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: generation2,
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        createdAt: toInstant("2026-10-02T07:01:00Z"),
      });
      await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation2,
        snapshot: firstSnapshots.alpha,
        builtAt: toInstant("2026-10-02T07:01:00Z"),
      });
    });

    await expect(
      activateMemoryProjectionGeneration(pool, {
        tenantId,
        memoryProjectionGenerationId: generation2,
        activatedAt: toInstant("2026-10-02T07:02:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "memory.projection_generation_incomplete",
    });

    await withTransaction(pool, (client) =>
      indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation2,
        snapshot: firstSnapshots.beta,
        builtAt: toInstant("2026-10-02T07:01:00Z"),
      }),
    );
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: generation2,
      activatedAt: toInstant("2026-10-02T07:02:00Z"),
    });

    await withTransaction(pool, async (client) => {
      const current = await getCurrentMemoryProjectionGeneration(
        client,
        tenantId,
        "lexical",
      );
      expect(current?.memoryProjectionGenerationId).toBe(generation2);
    });

    const rebuiltAlphaHits = await searchRelationship(
      relationshipA,
      "nebula",
    );
    expect(rebuiltAlphaHits.map((hit) => hit.memoryRecordId)).toEqual([
      recordA,
    ]);

    await pool.query(
      `DELETE FROM memory.projection_generations
        WHERE tenant_id = $1
          AND memory_projection_generation_id = $2
          AND state = 'retired'`,
      [tenantId, generation1],
    );
    const afterRetiredDeletion = await searchRelationship(
      relationshipA,
      "nebula",
    );
    expect(afterRetiredDeletion.map((hit) => hit.memoryRecordId)).toEqual([
      recordA,
    ]);

    const revisionA2 = createCanonicalId("memory-revision");
    await withTransaction(pool, (client) =>
      appendMemoryRevision(client, {
        tenantId,
        memoryRecordId: recordA,
        memoryRevisionId: revisionA2,
        expectedRevision: 1,
        content:
          "Corrected comet preference belongs only to relationship alpha.",
        extractionMethod: "fixture",
        observedAt: toInstant("2026-10-02T07:03:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:alpha:2",
            sourceContentHash: "c".repeat(64),
            observedAt: toInstant("2026-10-02T07:03:00Z"),
          },
        ],
        updatedAt: toInstant("2026-10-02T07:03:00Z"),
      }),
    );

    expect(await searchRelationship(relationshipA, "nebula")).toEqual([]);

    const currentSnapshots = await loadSnapshots();
    const generation3 = createCanonicalId("memory-projection-generation");
    await withTransaction(pool, async (client) => {
      await createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: generation3,
        kind: "lexical",
        implementationKey: "postgres-simple-tsvector",
        schemaVersion: 1,
        createdAt: toInstant("2026-10-02T07:04:00Z"),
      });
      await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation3,
        snapshot: currentSnapshots.alpha,
        builtAt: toInstant("2026-10-02T07:04:00Z"),
      });
      await indexMemoryLexicalSnapshot(client, {
        memoryProjectionGenerationId: generation3,
        snapshot: currentSnapshots.beta,
        builtAt: toInstant("2026-10-02T07:04:00Z"),
      });
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: generation3,
      activatedAt: toInstant("2026-10-02T07:05:00Z"),
    });

    const correctedHits = await searchRelationship(
      relationshipA,
      "corrected comet",
    );
    expect(correctedHits.map((hit) => hit.memoryRecordId)).toEqual([recordA]);
    expect(correctedHits[0]?.memoryRevisionId).toBe(revisionA2);
  });

  it("persists vector compatibility metadata and activates an empty complete generation", async () => {
    const tenantId = createCanonicalId("tenant");
    const generationId = createCanonicalId(
      "memory-projection-generation",
    );
    const now = toInstant("2026-10-02T08:00:00Z");

    const generation = await withTransaction(pool, (client) =>
      createMemoryProjectionGeneration(client, {
        tenantId,
        memoryProjectionGenerationId: generationId,
        kind: "vector",
        implementationKey: "future-pgvector",
        schemaVersion: 1,
        vectorCompatibility: {
          providerKey: "provider-fixture",
          modelKey: "embed-fixture-v1",
          dimension: 1536,
        },
        createdAt: now,
      }),
    );

    expect(generation.vectorCompatibility).toEqual({
      providerKey: "provider-fixture",
      modelKey: "embed-fixture-v1",
      dimension: 1536,
    });

    const activated = await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: generationId,
      activatedAt: now,
    });
    expect(activated.state).toBe("current");
    expect(activated.memoryProjectionGenerationId).toBe(generationId);
  });
});
