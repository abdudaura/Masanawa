import { fileURLToPath } from "node:url";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { memoryReflectionSourceFromSnapshot } from "@masanawa/memory";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  admitMemoryCompactionFlush,
  appendMemoryRevision,
  commitMemoryReflection,
  createMemoryRecord,
  createPostgresPool,
  createTenant,
  getMemoryRecordInScope,
  linkMemoryRecords,
  runMigrations,
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

describePostgres("PostgreSQL memory reflection and compaction custody", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-memory-reflection-integration",
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
    expect(applied).toContain("memory/0007_memory_reflections.sql");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("commits a scoped reflection once, replays after source absorption, and preserves derivation evidence", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const observedAt = toInstant("2026-10-02T10:30:00Z");
    const reflectedAt = toInstant("2026-10-02T10:40:00Z");
    const absorbedAt = toInstant("2026-10-02T10:50:00Z");

    const sourceAId = createCanonicalId("memory-record");
    const sourceARevisionId = createCanonicalId("memory-revision");
    const sourceBId = createCanonicalId("memory-record");
    const sourceBRevisionId = createCanonicalId("memory-revision");
    const consolidationTargetId = createCanonicalId("memory-record");
    const consolidationTargetRevisionId = createCanonicalId("memory-revision");
    const reflectionId = createCanonicalId("memory-record");
    const reflectionRevisionId = createCanonicalId("memory-revision");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: observedAt });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: sourceAId,
        memoryRevisionId: sourceARevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "The user repeatedly chooses quiet workspaces.",
        extractionMethod: "fixture",
        observedAt,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:a",
            sourceContentHash: "a".repeat(64),
            verbatimText: "I focus better somewhere quiet.",
            observedAt,
          },
        ],
        createdAt: observedAt,
      });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: sourceBId,
        memoryRevisionId: sourceBRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "The user avoids noisy cafes for concentrated work.",
        extractionMethod: "fixture",
        observedAt,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:b",
            sourceContentHash: "b".repeat(64),
            verbatimText: "Busy cafes make it hard for me to concentrate.",
            observedAt,
          },
        ],
        createdAt: observedAt,
      });

      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: consolidationTargetId,
        memoryRevisionId: consolidationTargetRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "The user prefers low-noise environments for focused work.",
        extractionMethod: "fixture",
        observedAt,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:consolidation",
            sourceContentHash: "c".repeat(64),
            observedAt,
          },
        ],
        createdAt: observedAt,
      });
    });

    const sourceSnapshots = await withTransaction(pool, async (client) => {
      const [sourceA, sourceB] = await Promise.all([
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: sourceAId,
          scope: { kind: "relationship", relationshipId },
        }),
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: sourceBId,
          scope: { kind: "relationship", relationshipId },
        }),
      ]);
      expect(sourceA).not.toBeNull();
      expect(sourceB).not.toBeNull();
      return [sourceA!, sourceB!] as const;
    });
    const sources = sourceSnapshots.map(memoryReflectionSourceFromSnapshot);

    const input = {
      tenantId,
      reflectionMemoryRecordId: reflectionId,
      reflectionMemoryRevisionId: reflectionRevisionId,
      scope: { kind: "relationship", relationshipId } as const,
      purposeKey: "workspace-preference-pattern",
      reflector: {
        key: "fixture-reflector",
        version: "v1",
      },
      sources,
      revision: {
        content:
          "The user consistently prefers quiet, low-noise environments when doing focused work.",
        extractionMethod: "reflection-fixture",
        observedAt: reflectedAt,
      },
      createdAt: reflectedAt,
    };

    const committed = await commitMemoryReflection(pool, input);
    expect(committed.reused).toBe(false);
    expect(committed.record.record.memoryType).toBe("reflection");
    expect(committed.record.record.scope).toEqual({
      kind: "relationship",
      relationshipId,
    });
    expect(committed.reflection.sources).toEqual(sources);
    expect(committed.record.currentRevision.evidence).toEqual([
      expect.objectContaining({
        sourceKind: "other",
        sourceReference:
          "memory-reflection:" + committed.reflection.reflectionFingerprint,
        sourceContentHash: committed.reflection.reflectionFingerprint,
      }),
    ]);

    const absorption = await withTransaction(pool, (client) =>
      linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId: sourceAId,
        targetMemoryRecordId: consolidationTargetId,
        expectedSourceLifecycleRevision: 1,
        kind: "absorbs",
        reason: "Consolidated the source fact after reflection was committed.",
        transitionedAt: absorbedAt,
      }),
    );
    expect(absorption.source.record.lifecycleState).toBe("absorbed");

    const replay = await commitMemoryReflection(pool, {
      ...input,
      reflectionMemoryRecordId: createCanonicalId("memory-record"),
      reflectionMemoryRevisionId: createCanonicalId("memory-revision"),
      revision: {
        ...input.revision,
        content:
          "A retry phrased the same reflection differently, but identity must not change.",
      },
      createdAt: toInstant("2026-10-02T11:00:00Z"),
    });
    expect(replay.reused).toBe(true);
    expect(replay.reflection.reflectionMemoryRecordId).toBe(reflectionId);
    expect(replay.reflection.reflectionMemoryRevisionId).toBe(
      reflectionRevisionId,
    );
    expect(replay.record.currentRevision.content).toBe(
      input.revision.content,
    );

    const consolidatedReflection = await commitMemoryReflection(pool, {
      tenantId,
      reflectionMemoryRecordId: createCanonicalId("memory-record"),
      reflectionMemoryRevisionId: createCanonicalId("memory-revision"),
      scope: { kind: "relationship", relationshipId },
      purposeKey: "workspace-preference-consolidated",
      reflector: {
        key: "fixture-reflector",
        version: "v1",
      },
      sources: [sources[1]!],
      revision: {
        content:
          "Quiet work environments are a durable preference for focused tasks.",
        extractionMethod: "reflection-fixture",
        observedAt: toInstant("2026-10-02T11:05:00Z"),
      },
      createdAt: toInstant("2026-10-02T11:05:00Z"),
    });
    const reflectionAbsorption = await withTransaction(pool, (client) =>
      linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId: reflectionId,
        targetMemoryRecordId:
          consolidatedReflection.reflection.reflectionMemoryRecordId,
        expectedSourceLifecycleRevision: 1,
        kind: "absorbs",
        reason: "Consolidated a narrower reflection into the durable reflection.",
        transitionedAt: toInstant("2026-10-02T11:10:00Z"),
      }),
    );
    expect(reflectionAbsorption.source.record.memoryType).toBe("reflection");
    expect(reflectionAbsorption.source.record.lifecycleState).toBe("absorbed");
    expect(reflectionAbsorption.target.record.memoryType).toBe("reflection");
    expect(reflectionAbsorption.target.record.lifecycleState).toBe("active");

    const persisted = await pool.query<{
      source_count: string;
      source_a_state: string;
      source_a_revision_count: string;
      source_a_evidence_count: string;
      reflection_count: string;
    }>(
      `SELECT
         (SELECT count(*)::text
            FROM memory.reflection_sources
           WHERE tenant_id = $1
             AND reflection_fingerprint = $2) AS source_count,
         (SELECT lifecycle_state
            FROM memory.records
           WHERE tenant_id = $1
             AND memory_record_id = $3) AS source_a_state,
         (SELECT count(*)::text
            FROM memory.revisions
           WHERE tenant_id = $1
             AND memory_record_id = $3) AS source_a_revision_count,
         (SELECT count(*)::text
            FROM memory.evidence e
            JOIN memory.revisions r
              ON r.tenant_id = e.tenant_id
             AND r.memory_revision_id = e.memory_revision_id
           WHERE r.tenant_id = $1
             AND r.memory_record_id = $3) AS source_a_evidence_count,
         (SELECT count(*)::text
            FROM memory.reflections
           WHERE tenant_id = $1
             AND reflection_fingerprint = $2) AS reflection_count`,
      [
        tenantId,
        committed.reflection.reflectionFingerprint,
        sourceAId,
      ],
    );
    expect(persisted.rows[0]).toEqual({
      source_count: "2",
      source_a_state: "absorbed",
      source_a_revision_count: "1",
      source_a_evidence_count: "1",
      reflection_count: "1",
    });

    await expect(
      pool.query(
        `UPDATE memory.reflections
            SET purpose_key = 'rewritten'
          WHERE tenant_id = $1
            AND reflection_fingerprint = $2`,
        [tenantId, committed.reflection.reflectionFingerprint],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `UPDATE memory.reflection_sources
            SET source_content_hash = $3
          WHERE tenant_id = $1
            AND reflection_fingerprint = $2
            AND ordinal = 0`,
        [
          tenantId,
          committed.reflection.reflectionFingerprint,
          "f".repeat(64),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("fails first reflection commit on cross-scope or source-revision drift", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const now = toInstant("2026-10-02T12:00:00Z");

    const sourceAId = createCanonicalId("memory-record");
    const sourceARevision1 = createCanonicalId("memory-revision");
    const sourceBId = createCanonicalId("memory-record");
    const sourceBRevision1 = createCanonicalId("memory-revision");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: sourceAId,
        memoryRevisionId: sourceARevision1,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId: relationshipA },
        content: "Alpha fact.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:scope:a",
            sourceContentHash: "d".repeat(64),
            observedAt: now,
          },
        ],
        createdAt: now,
      });
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: sourceBId,
        memoryRevisionId: sourceBRevision1,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId: relationshipB },
        content: "Beta fact.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:scope:b",
            sourceContentHash: "e".repeat(64),
            observedAt: now,
          },
        ],
        createdAt: now,
      });
    });

    const [alpha, beta] = await withTransaction(pool, async (client) => {
      const [a, b] = await Promise.all([
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: sourceAId,
          scope: { kind: "relationship", relationshipId: relationshipA },
        }),
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: sourceBId,
          scope: { kind: "relationship", relationshipId: relationshipB },
        }),
      ]);
      return [a!, b!] as const;
    });

    await expect(
      commitMemoryReflection(pool, {
        tenantId,
        reflectionMemoryRecordId: createCanonicalId("memory-record"),
        reflectionMemoryRevisionId: createCanonicalId("memory-revision"),
        scope: { kind: "relationship", relationshipId: relationshipA },
        purposeKey: "cross-scope",
        reflector: { key: "fixture", version: "v1" },
        sources: [
          memoryReflectionSourceFromSnapshot(alpha),
          memoryReflectionSourceFromSnapshot(beta),
        ],
        revision: {
          content: "This must not be persisted.",
          extractionMethod: "reflection-fixture",
          observedAt: now,
        },
        createdAt: now,
      }),
    ).rejects.toMatchObject({
      code: "memory.reflection_source_scope_mismatch",
    });

    const staleSource = memoryReflectionSourceFromSnapshot(alpha);
    await withTransaction(pool, (client) =>
      appendMemoryRevision(client, {
        tenantId,
        memoryRecordId: sourceAId,
        memoryRevisionId: createCanonicalId("memory-revision"),
        expectedRevision: 1,
        content: "Alpha fact was corrected before reflection commit.",
        extractionMethod: "fixture",
        observedAt: toInstant("2026-10-02T12:01:00Z"),
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "message:reflection:scope:a:corrected",
            sourceContentHash: "1".repeat(64),
            observedAt: toInstant("2026-10-02T12:01:00Z"),
          },
        ],
        updatedAt: toInstant("2026-10-02T12:01:00Z"),
      }),
    );

    await expect(
      commitMemoryReflection(pool, {
        tenantId,
        reflectionMemoryRecordId: createCanonicalId("memory-record"),
        reflectionMemoryRevisionId: createCanonicalId("memory-revision"),
        scope: { kind: "relationship", relationshipId: relationshipA },
        purposeKey: "stale-source",
        reflector: { key: "fixture", version: "v1" },
        sources: [staleSource],
        revision: {
          content: "This must also not be persisted.",
          extractionMethod: "reflection-fixture",
          observedAt: now,
        },
        createdAt: now,
      }),
    ).rejects.toMatchObject({
      code: "memory.reflection_source_changed",
    });

    const counts = await pool.query<{
      reflections: string;
      reflection_records: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM memory.reflections
           WHERE tenant_id = $1) AS reflections,
         (SELECT count(*)::text FROM memory.records
           WHERE tenant_id = $1
             AND memory_type = 'reflection') AS reflection_records`,
      [tenantId],
    );
    expect(counts.rows[0]).toEqual({
      reflections: "0",
      reflection_records: "0",
    });
  });

  it("reuses extraction custody for compaction flush and fails closed on scope drift", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipA = createCanonicalId("relationship");
    const relationshipB = createCanonicalId("relationship");
    const now = toInstant("2026-10-02T13:00:00Z");

    await withTransaction(pool, (client) =>
      createTenant(client, { tenantId, createdAt: now }),
    );

    const base = {
      tenantId,
      flushKey: "character-session:42:pre-compaction",
      scope: { kind: "relationship", relationshipId: relationshipA } as const,
      source: {
        kind: "message" as const,
        reference: "conversation-window:42",
        contentHash: "2".repeat(64),
      },
      extractor: {
        key: "compaction-flush",
        version: "v1",
      },
      maxAttempts: 3,
      availableAt: now,
    };

    const admitted = await admitMemoryCompactionFlush(pool, base);
    expect(admitted.safeToCompact).toBe(true);
    expect(admitted.extraction.reused).toBe(false);
    expect(admitted.extraction.job.scope).toEqual(base.scope);
    expect(admitted.extraction.job.idempotencyKey).toBe(
      "compaction-flush:character-session:42:pre-compaction",
    );

    const replay = await admitMemoryCompactionFlush(pool, {
      ...base,
      availableAt: toInstant("2026-10-02T13:01:00Z"),
    });
    expect(replay.safeToCompact).toBe(true);
    expect(replay.extraction.reused).toBe(true);
    expect(replay.extraction.job.memoryExtractionId).toBe(
      admitted.extraction.job.memoryExtractionId,
    );

    await expect(
      admitMemoryCompactionFlush(pool, {
        ...base,
        scope: { kind: "relationship", relationshipId: relationshipB },
      }),
    ).rejects.toMatchObject({
      code: "memory.extraction_idempotency_conflict",
    });

    await expect(
      admitMemoryCompactionFlush(pool, {
        ...base,
        flushKey: "character-session:42:invalid",
        source: {
          ...base.source,
          contentHash: "not-a-hash",
        },
      }),
    ).rejects.toThrow(/SHA-256/u);

    const jobs = await pool.query<{
      count: string;
      scope_ref_id: string;
    }>(
      `SELECT count(*)::text AS count,
              min(scope_ref_id) AS scope_ref_id
         FROM memory.extraction_jobs
        WHERE tenant_id = $1
          AND idempotency_key LIKE 'compaction-flush:%'`,
      [tenantId],
    );
    expect(jobs.rows[0]).toEqual({
      count: "1",
      scope_ref_id: relationshipA,
    });
  });
});
