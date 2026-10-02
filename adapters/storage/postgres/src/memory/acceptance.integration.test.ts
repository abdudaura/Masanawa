import { fileURLToPath } from "node:url";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  assertZeroMemoryRetrievalLeakage,
  createMemoryScopePredicate,
  evaluateMemoryRetrieval,
} from "@masanawa/memory";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  activateMemoryProjectionGeneration,
  createMemoryProjectionGeneration,
  createMemoryRecord,
  createPostgresPool,
  createTenant,
  getMemoryRecordInScope,
  indexMemoryEntitySnapshot,
  indexMemoryLexicalSnapshot,
  indexMemoryTemporalSnapshot,
  linkMemoryRecords,
  runMigrations,
  searchMemoryEntity,
  searchMemoryHybrid,
  searchMemoryTemporal,
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

describePostgres("Phase 4 memory acceptance retrieval", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-memory-acceptance",
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
    await runMigrations(pool, migrationRoots);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("held-out entity, temporal and hybrid retrieval select corrected current truth and forbid the contradicted predecessor", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const oldRecordId = createCanonicalId("memory-record");
    const oldRevisionId = createCanonicalId("memory-revision");
    const currentRecordId = createCanonicalId("memory-record");
    const currentRevisionId = createCanonicalId("memory-revision");
    const createdAt = toInstant("2026-10-02T14:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: oldRecordId,
        memoryRevisionId: oldRevisionId,
        memoryType: "preference",
        scope: { kind: "relationship", relationshipId },
        content: "The user prefers a seven o'clock morning reminder.",
        extractionMethod: "acceptance-fixture",
        eventTime: toInstant("2026-10-01T07:00:00Z"),
        observedAt: toInstant("2026-10-01T07:05:00Z"),
        validFrom: toInstant("2026-10-01T07:00:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:held-out:contradiction:old",
            sourceContentHash: "7".repeat(64),
            verbatimText: "Remind me at seven in the morning.",
            observedAt: toInstant("2026-10-01T07:05:00Z"),
          },
        ],
        createdAt,
      });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: currentRecordId,
        memoryRevisionId: currentRevisionId,
        memoryType: "preference",
        scope: { kind: "relationship", relationshipId },
        content: "The user now prefers an eight o'clock morning reminder.",
        extractionMethod: "acceptance-fixture",
        eventTime: toInstant("2026-10-02T08:00:00Z"),
        observedAt: toInstant("2026-10-02T08:05:00Z"),
        validFrom: toInstant("2026-10-02T08:00:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:held-out:contradiction:current",
            sourceContentHash: "8".repeat(64),
            verbatimText: "Change it — remind me at eight instead.",
            observedAt: toInstant("2026-10-02T08:05:00Z"),
          },
        ],
        createdAt,
      });
    });

    const snapshots = await withTransaction(pool, async (client) => {
      const [oldSnapshot, currentSnapshot] = await Promise.all([
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: oldRecordId,
          scope: { kind: "relationship", relationshipId },
        }),
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: currentRecordId,
          scope: { kind: "relationship", relationshipId },
        }),
      ]);
      expect(oldSnapshot).not.toBeNull();
      expect(currentSnapshot).not.toBeNull();
      return [oldSnapshot!, currentSnapshot!] as const;
    });

    const lexicalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const entityGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const temporalGeneration = createCanonicalId(
      "memory-projection-generation",
    );
    const builtAt = toInstant("2026-10-02T14:05:00Z");

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

      for (const snapshot of snapshots) {
        await indexMemoryLexicalSnapshot(client, {
          memoryProjectionGenerationId: lexicalGeneration,
          snapshot,
          builtAt,
        });
        await indexMemoryEntitySnapshot(client, {
          memoryProjectionGenerationId: entityGeneration,
          snapshot,
          entityKeys: ["morning-reminder", "reminder-time"],
          builtAt,
        });
        await indexMemoryTemporalSnapshot(client, {
          memoryProjectionGenerationId: temporalGeneration,
          snapshot,
          builtAt,
        });
      }
    });

    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: lexicalGeneration,
      activatedAt: toInstant("2026-10-02T14:06:00Z"),
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: entityGeneration,
      activatedAt: toInstant("2026-10-02T14:06:01Z"),
    });
    await activateMemoryProjectionGeneration(pool, {
      tenantId,
      memoryProjectionGenerationId: temporalGeneration,
      activatedAt: toInstant("2026-10-02T14:06:02Z"),
    });

    const linked = await withTransaction(pool, (client) =>
      linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId: oldRecordId,
        targetMemoryRecordId: currentRecordId,
        expectedSourceLifecycleRevision: 1,
        kind: "supersedes",
        reason:
          "Later explicit evidence changed the requested morning reminder time.",
        transitionedAt: toInstant("2026-10-02T14:07:00Z"),
      }),
    );
    expect(linked.source.record.lifecycleState).toBe("superseded");
    expect(linked.target.record.lifecycleState).toBe("active");

    const scopePredicate = createMemoryScopePredicate([
      { kind: "relationship", relationshipId },
    ]);

    const entityHits = await withTransaction(
      pool,
      (client) =>
        searchMemoryEntity(client, {
          tenantId,
          scopePredicate,
          entityKeys: ["morning-reminder"],
          limit: 10,
        }),
      { readOnly: true },
    );
    const temporalHits = await withTransaction(
      pool,
      (client) =>
        searchMemoryTemporal(client, {
          tenantId,
          scopePredicate,
          fromInclusive: toInstant("2026-10-01T00:00:00Z"),
          toExclusive: toInstant("2026-10-03T00:00:00Z"),
          limit: 10,
        }),
      { readOnly: true },
    );
    const hybridHits = await searchMemoryHybrid(pool, {
      tenantId,
      scopePredicate,
      lexicalQuery: "morning reminder",
      entityKeys: ["morning-reminder"],
      temporal: {
        fromInclusive: toInstant("2026-10-01T00:00:00Z"),
        toExclusive: toInstant("2026-10-03T00:00:00Z"),
      },
      limit: 10,
    });

    for (const [name, recordIds] of [
      [
        "held-out-entity-current-view",
        entityHits.map((hit) => hit.memoryRecordId),
      ],
      [
        "held-out-temporal-current-view",
        temporalHits.map((hit) => hit.memoryRecordId),
      ],
      [
        "held-out-contradiction-current-view",
        hybridHits.map((hit) => hit.memoryRecordId),
      ],
    ] as const) {
      const summary = evaluateMemoryRetrieval({
        name,
        partition: "held-out",
        cases: [
          {
            caseId: "corrected-morning-reminder",
            expectedRecordIds: [currentRecordId],
            forbiddenRecordIds: [oldRecordId],
            retrievedRecordIds: recordIds,
          },
        ],
      });
      expect(summary).toMatchObject({
        partition: "held-out",
        expectedRecordCount: 1,
        relevantRetrievedCount: 1,
        forbiddenHitCount: 0,
        leakageCaseCount: 0,
        recall: 1,
        precision: 1,
        meanReciprocalRank: 1,
        privacyPass: true,
      });
      assertZeroMemoryRetrievalLeakage(summary);
    }

    expect(entityHits.map((hit) => hit.memoryRecordId)).toEqual([
      currentRecordId,
    ]);
    expect(temporalHits.map((hit) => hit.memoryRecordId)).toEqual([
      currentRecordId,
    ]);
    expect(hybridHits.map((hit) => hit.memoryRecordId)).toEqual([
      currentRecordId,
    ]);

    const historical = await withTransaction(pool, (client) =>
      getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId: oldRecordId,
        scope: { kind: "relationship", relationshipId },
      }),
    );
    expect(historical?.record.lifecycleState).toBe("superseded");
    expect(historical?.currentRevision.evidence[0]?.verbatimText).toBe(
      "Remind me at seven in the morning.",
    );
  });
});
