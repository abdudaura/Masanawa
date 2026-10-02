import {
  PlatformError,
  toInstant,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import {
  assertMemoryReflectionTargetIsDistinct,
  memoryProjectionSourceContentHash,
  memoryReflectionFingerprint,
  memoryScopeFromStorage,
  memoryScopeStorage,
  normalizeMemoryReflectionIdentity,
  type CommitMemoryReflectionInput,
  type MemoryRecordSnapshot,
  type MemoryReflection,
  type MemoryReflectionSource,
  type MemoryScopeKind,
} from "@masanawa/memory";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import {
  createMemoryRecord,
  getMemoryRecordInScope,
} from "./repository.js";

interface ReflectionRow {
  tenant_id: TenantId;
  reflection_fingerprint: string;
  reflection_memory_record_id: MemoryRecordId;
  reflection_memory_revision_id: MemoryRevisionId;
  scope_kind: MemoryScopeKind;
  scope_ref_id: string | null;
  purpose_key: string;
  reflector_key: string;
  reflector_version: string;
  source_count: number;
  created_at: Date;
}

interface ReflectionSourceRow {
  tenant_id: TenantId;
  reflection_fingerprint: string;
  ordinal: number;
  source_memory_record_id: MemoryRecordId;
  source_memory_revision_id: MemoryRevisionId;
  source_content_hash: string;
}

export interface CommittedMemoryReflection {
  readonly reflection: MemoryReflection;
  readonly record: MemoryRecordSnapshot;
  readonly reused: boolean;
}

const reflectionSelect = `
  SELECT tenant_id,
         reflection_fingerprint,
         reflection_memory_record_id,
         reflection_memory_revision_id,
         scope_kind,
         scope_ref_id,
         purpose_key,
         reflector_key,
         reflector_version,
         source_count,
         created_at
    FROM memory.reflections
`;

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function sourceFromRow(row: ReflectionSourceRow): MemoryReflectionSource {
  return Object.freeze({
    memoryRecordId: row.source_memory_record_id,
    memoryRevisionId: row.source_memory_revision_id,
    sourceContentHash: row.source_content_hash,
  });
}

async function loadMemoryReflection(
  client: PoolClient,
  tenantId: TenantId,
  reflectionFingerprint: string,
): Promise<MemoryReflection | null> {
  const result = await client.query<ReflectionRow>(
    `${reflectionSelect}
      WHERE tenant_id = $1
        AND reflection_fingerprint = $2`,
    [tenantId, reflectionFingerprint],
  );
  const row = result.rows[0];
  if (!row) return null;

  const sources = await client.query<ReflectionSourceRow>(
    `SELECT tenant_id,
            reflection_fingerprint,
            ordinal,
            source_memory_record_id,
            source_memory_revision_id,
            source_content_hash
       FROM memory.reflection_sources
      WHERE tenant_id = $1
        AND reflection_fingerprint = $2
      ORDER BY ordinal`,
    [tenantId, reflectionFingerprint],
  );
  if (sources.rows.length !== row.source_count) {
    throw new Error(
      "Memory reflection audit has inconsistent source cardinality",
    );
  }

  return Object.freeze({
    tenantId: row.tenant_id,
    reflectionFingerprint: row.reflection_fingerprint,
    reflectionMemoryRecordId: row.reflection_memory_record_id,
    reflectionMemoryRevisionId: row.reflection_memory_revision_id,
    scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
    purposeKey: row.purpose_key,
    reflector: Object.freeze({
      key: row.reflector_key,
      version: row.reflector_version,
    }),
    sources: Object.freeze(sources.rows.map(sourceFromRow)),
    createdAt: toInstant(row.created_at),
  });
}

export async function getMemoryReflection(
  client: PoolClient,
  tenantId: TenantId,
  reflectionFingerprint: string,
): Promise<MemoryReflection | null> {
  return loadMemoryReflection(client, tenantId, reflectionFingerprint);
}

async function committedFromExisting(
  client: PoolClient,
  reflection: MemoryReflection,
): Promise<CommittedMemoryReflection> {
  const record = await getMemoryRecordInScope(client, {
    tenantId: reflection.tenantId,
    memoryRecordId: reflection.reflectionMemoryRecordId,
    scope: reflection.scope,
  });
  if (!record) {
    throw new Error(
      "Memory reflection audit references a missing canonical MemoryRecord",
    );
  }
  return Object.freeze({
    reflection,
    record,
    reused: true,
  });
}

async function lockAndValidateReflectionSources(
  client: PoolClient,
  input: CommitMemoryReflectionInput,
  sources: readonly MemoryReflectionSource[],
): Promise<void> {
  const sourceIds = sources.map((source) => source.memoryRecordId);
  const locked = await client.query<{ memory_record_id: MemoryRecordId }>(
    `SELECT memory_record_id
       FROM memory.records
      WHERE tenant_id = $1
        AND memory_record_id = ANY($2::text[])
      ORDER BY memory_record_id
      FOR UPDATE`,
    [input.tenantId, sourceIds],
  );
  if (locked.rows.length !== sources.length) {
    throw new PlatformError({
      code: "memory.reflection_source_not_found",
      category: "not-found",
      message:
        "One or more reflection source memories do not exist in the tenant",
      retryable: false,
    });
  }

  for (const source of sources) {
    const snapshot = await getMemoryRecordInScope(client, {
      tenantId: input.tenantId,
      memoryRecordId: source.memoryRecordId,
      scope: input.scope,
    });
    if (!snapshot) {
      throw new PlatformError({
        code: "memory.reflection_source_scope_mismatch",
        category: "authorization",
        message:
          "Reflection source is outside the exact output MemoryScope",
        retryable: false,
      });
    }
    if (snapshot.record.lifecycleState !== "active") {
      throw conflict(
        "memory.reflection_source_not_active",
        "Reflection source must still be active when the reflection is first committed",
      );
    }
    if (
      snapshot.currentRevision.memoryRevisionId !==
        source.memoryRevisionId ||
      memoryProjectionSourceContentHash(snapshot) !==
        source.sourceContentHash
    ) {
      throw conflict(
        "memory.reflection_source_changed",
        "Reflection source revision/content changed before commit",
      );
    }
  }
}

async function commitMemoryReflectionInTransaction(
  client: PoolClient,
  input: CommitMemoryReflectionInput,
): Promise<CommittedMemoryReflection> {
  assertMemoryReflectionTargetIsDistinct(input);
  const normalized = normalizeMemoryReflectionIdentity(input);
  const reflectionFingerprint = memoryReflectionFingerprint(input);

  const existing = await loadMemoryReflection(
    client,
    input.tenantId,
    reflectionFingerprint,
  );
  if (existing) {
    return committedFromExisting(client, existing);
  }

  await lockAndValidateReflectionSources(
    client,
    input,
    normalized.sources,
  );

  // Source locks serialize competing commits for the same exact source set.
  // Recheck after acquiring them so only one target MemoryRecord is created.
  const raced = await loadMemoryReflection(
    client,
    input.tenantId,
    reflectionFingerprint,
  );
  if (raced) {
    return committedFromExisting(client, raced);
  }

  const reflectionRecord = await createMemoryRecord(client, {
    tenantId: input.tenantId,
    memoryRecordId: input.reflectionMemoryRecordId,
    memoryRevisionId: input.reflectionMemoryRevisionId,
    memoryType: "reflection",
    scope: normalized.scope,
    ...input.revision,
    evidence: [
      {
        sourceKind: "other",
        sourceReference: `memory-reflection:${reflectionFingerprint}`,
        sourceContentHash: reflectionFingerprint,
        observedAt: input.revision.observedAt,
      },
    ],
    createdAt: input.createdAt,
  });

  const scope = memoryScopeStorage(normalized.scope);
  await client.query(
    `INSERT INTO memory.reflections (
       tenant_id,
       reflection_fingerprint,
       reflection_memory_record_id,
       reflection_memory_revision_id,
       scope_kind,
       scope_ref_id,
       purpose_key,
       reflector_key,
       reflector_version,
       source_count,
       created_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.tenantId,
      reflectionFingerprint,
      input.reflectionMemoryRecordId,
      input.reflectionMemoryRevisionId,
      scope.kind,
      scope.referenceId,
      normalized.purposeKey,
      normalized.reflector.key,
      normalized.reflector.version,
      normalized.sources.length,
      input.createdAt,
    ],
  );

  for (let ordinal = 0; ordinal < normalized.sources.length; ordinal += 1) {
    const source = normalized.sources[ordinal]!;
    await client.query(
      `INSERT INTO memory.reflection_sources (
         tenant_id,
         reflection_fingerprint,
         ordinal,
         source_memory_record_id,
         source_memory_revision_id,
         source_content_hash
       )
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.tenantId,
        reflectionFingerprint,
        ordinal,
        source.memoryRecordId,
        source.memoryRevisionId,
        source.sourceContentHash,
      ],
    );
  }

  const reflection = await loadMemoryReflection(
    client,
    input.tenantId,
    reflectionFingerprint,
  );
  if (!reflection) {
    throw new Error(
      "Memory reflection commit completed without readable derivation audit",
    );
  }

  return Object.freeze({
    reflection,
    record: reflectionRecord,
    reused: false,
  });
}

export async function commitMemoryReflection(
  pool: Pool,
  input: CommitMemoryReflectionInput,
): Promise<CommittedMemoryReflection> {
  return withTransaction(pool, (client) =>
    commitMemoryReflectionInTransaction(client, input),
  );
}
