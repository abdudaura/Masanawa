import {
  PlatformError,
  toInstant,
  type Instant,
  type MemoryProjectionGenerationId,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import {
  assertMemoryRetrievalAdapterCapabilities,
  assertMemoryVectorCompatibility,
  memoryProjectionSourceContentHash,
  memoryScopeFromStorage,
  memoryScopeStorage,
  normalizeMemoryEntityProjectionKeys,
  normalizeMemoryEntitySearchInput,
  normalizeMemoryTemporalSearchInput,
  normalizeMemoryVectorSearchInput,
  type MemoryEntityHit,
  type MemoryEntitySearchInput,
  type MemoryProjectionKind,
  type MemoryRecordSnapshot,
  type MemoryScope,
  type MemoryScopeKind,
  type MemoryTemporalHit,
  type MemoryTemporalSearchInput,
  type MemoryType,
  type MemoryVectorHit,
  type MemoryVectorSearchInput,
} from "@masanawa/memory";
import type { PoolClient } from "pg";
import {
  getCurrentMemoryProjectionGeneration,
  getMemoryProjectionGeneration,
  postgresMemoryRetrievalCapabilities,
} from "./projection.js";

interface SignalProjectionRow {
  tenant_id: TenantId;
  memory_projection_generation_id: MemoryProjectionGenerationId;
  memory_record_id: MemoryRecordId;
  memory_revision_id: MemoryRevisionId;
  memory_type: MemoryType;
  scope_kind: MemoryScopeKind;
  scope_ref_id: string | null;
  source_content_hash: string;
  built_at: Date;
}

interface VectorProjectionRow extends SignalProjectionRow {
  embedding_matches: boolean;
}

interface EntityProjectionRow extends SignalProjectionRow {
  entity_keys: string[];
}

interface TemporalProjectionRow extends SignalProjectionRow {
  event_time: Date | null;
  observed_at: Date;
  valid_from: Date | null;
  valid_to: Date | null;
  expires_at: Date | null;
}

interface VectorHitRow extends SignalProjectionRow {
  canonical_content: string;
  similarity: number;
}

interface EntityHitRow extends SignalProjectionRow {
  canonical_content: string;
  matched_entity_keys: string[];
  entity_score: number;
}

interface TemporalHitRow extends SignalProjectionRow {
  canonical_content: string;
  temporal_anchor: Date;
  event_time: Date | null;
  observed_at: Date;
  valid_from: Date | null;
  valid_to: Date | null;
  expires_at: Date | null;
}

export interface IndexMemoryVectorSnapshotInput {
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly snapshot: MemoryRecordSnapshot;
  readonly embedding: readonly number[];
  readonly builtAt: Instant;
}

export interface IndexMemoryEntitySnapshotInput {
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly snapshot: MemoryRecordSnapshot;
  readonly entityKeys: readonly string[];
  readonly builtAt: Instant;
}

export interface IndexMemoryTemporalSnapshotInput {
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly snapshot: MemoryRecordSnapshot;
  readonly builtAt: Instant;
}

export interface IndexedMemorySignalSnapshot {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly sourceContentHash: string;
  readonly builtAt: Instant;
  readonly reused: boolean;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function assertProjectableSnapshot(snapshot: MemoryRecordSnapshot): void {
  if (snapshot.record.lifecycleState !== "active") {
    throw conflict(
      "memory.projection_source_not_active",
      "Only an active canonical MemoryRecord can be projected",
    );
  }
  if (
    snapshot.record.currentRevisionId !==
      snapshot.currentRevision.memoryRevisionId ||
    snapshot.record.revision !== snapshot.currentRevision.revisionNumber
  ) {
    throw conflict(
      "memory.projection_source_stale",
      "Projection source snapshot is not the canonical current revision",
    );
  }
}

async function requireBuildingGeneration(
  client: PoolClient,
  snapshot: MemoryRecordSnapshot,
  memoryProjectionGenerationId: MemoryProjectionGenerationId,
  kind: MemoryProjectionKind,
) {
  const generation = await getMemoryProjectionGeneration(
    client,
    snapshot.record.tenantId,
    memoryProjectionGenerationId,
  );
  if (!generation) {
    throw new PlatformError({
      code: "memory.projection_generation_not_found",
      category: "not-found",
      message: "Memory projection generation was not found",
      retryable: false,
    });
  }
  if (generation.kind !== kind || generation.state !== "building") {
    throw conflict(
      "memory.projection_generation_not_building",
      "Projection target must be a matching building generation",
    );
  }
  return generation;
}

function vectorLiteral(values: readonly number[]): string {
  return `[${values.map((value) => String(value)).join(",")}]`;
}

function normalizeIndexVector(
  values: readonly number[],
  dimension: number,
): readonly number[] {
  if (!Array.isArray(values) || values.length !== dimension) {
    throw new RangeError(
      "embedding length must exactly match projection generation dimension",
    );
  }
  if (dimension > 16_000) {
    throw conflict(
      "memory.vector_dimension_unsupported",
      "PostgreSQL pgvector supports at most 16000 dimensions for this adapter",
    );
  }

  let squaredNorm = 0;
  const normalized = values.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("embedding values must be finite numbers");
    }
    squaredNorm += value * value;
    return value;
  });
  if (!Number.isFinite(squaredNorm) || squaredNorm <= 0) {
    throw new RangeError("embedding must have a finite non-zero norm");
  }
  return Object.freeze(normalized);
}

function indexedSignal(
  row: SignalProjectionRow,
  reused: boolean,
): IndexedMemorySignalSnapshot {
  return Object.freeze({
    tenantId: row.tenant_id,
    memoryProjectionGenerationId: row.memory_projection_generation_id,
    memoryRecordId: row.memory_record_id,
    memoryRevisionId: row.memory_revision_id,
    sourceContentHash: row.source_content_hash,
    builtAt: toInstant(row.built_at),
    reused,
  });
}

function sameSignalIdentity(
  row: SignalProjectionRow,
  snapshot: MemoryRecordSnapshot,
  sourceContentHash: string,
  builtAt: Instant,
): boolean {
  const scope = memoryScopeStorage(snapshot.record.scope);
  return (
    row.memory_revision_id === snapshot.currentRevision.memoryRevisionId &&
    row.memory_type === snapshot.record.memoryType &&
    row.scope_kind === scope.kind &&
    row.scope_ref_id === scope.referenceId &&
    row.source_content_hash === sourceContentHash &&
    toInstant(row.built_at) === builtAt
  );
}

function authorizedScopeRows(
  scopes: readonly MemoryScope[],
): readonly { scope_kind: MemoryScopeKind; scope_ref_id: string | null }[] {
  return scopes.map((scope) => {
    const stored = memoryScopeStorage(scope);
    return {
      scope_kind: stored.kind,
      scope_ref_id: stored.referenceId,
    };
  });
}

export async function indexMemoryVectorSnapshot(
  client: PoolClient,
  input: IndexMemoryVectorSnapshotInput,
): Promise<IndexedMemorySignalSnapshot> {
  assertProjectableSnapshot(input.snapshot);
  const generation = await requireBuildingGeneration(
    client,
    input.snapshot,
    input.memoryProjectionGenerationId,
    "vector",
  );
  if (!generation.vectorCompatibility) {
    throw conflict(
      "memory.vector_generation_incompatible",
      "Vector generation is missing provider/model/dimension compatibility",
    );
  }

  const embedding = normalizeIndexVector(
    input.embedding,
    generation.vectorCompatibility.dimension,
  );
  const literal = vectorLiteral(embedding);
  const scope = memoryScopeStorage(input.snapshot.record.scope);
  const sourceContentHash = memoryProjectionSourceContentHash(input.snapshot);
  const builtAt = toInstant(input.builtAt);

  const inserted = await client.query<SignalProjectionRow>(
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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10)
     ON CONFLICT (
       tenant_id,
       memory_projection_generation_id,
       memory_record_id
     ) DO NOTHING
     RETURNING tenant_id,
               memory_projection_generation_id,
               memory_record_id,
               memory_revision_id,
               memory_type,
               scope_kind,
               scope_ref_id,
               source_content_hash,
               built_at`,
    [
      input.snapshot.record.tenantId,
      input.memoryProjectionGenerationId,
      input.snapshot.record.memoryRecordId,
      input.snapshot.currentRevision.memoryRevisionId,
      input.snapshot.record.memoryType,
      scope.kind,
      scope.referenceId,
      sourceContentHash,
      literal,
      builtAt,
    ],
  );

  if (inserted.rows[0]) {
    return indexedSignal(inserted.rows[0], false);
  }

  const existing = await client.query<VectorProjectionRow>(
    `SELECT tenant_id,
            memory_projection_generation_id,
            memory_record_id,
            memory_revision_id,
            memory_type,
            scope_kind,
            scope_ref_id,
            source_content_hash,
            built_at,
            embedding = $4::vector AS embedding_matches
       FROM memory.vector_projections
      WHERE tenant_id = $1
        AND memory_projection_generation_id = $2
        AND memory_record_id = $3`,
    [
      input.snapshot.record.tenantId,
      input.memoryProjectionGenerationId,
      input.snapshot.record.memoryRecordId,
      literal,
    ],
  );
  const row = existing.rows[0];
  if (
    !row ||
    !sameSignalIdentity(row, input.snapshot, sourceContentHash, builtAt) ||
    !row.embedding_matches
  ) {
    throw conflict(
      "memory.projection_record_conflict",
      "Vector generation already contains a different projection for this MemoryRecord",
    );
  }
  return indexedSignal(row, true);
}

export async function indexMemoryEntitySnapshot(
  client: PoolClient,
  input: IndexMemoryEntitySnapshotInput,
): Promise<IndexedMemorySignalSnapshot> {
  assertProjectableSnapshot(input.snapshot);
  await requireBuildingGeneration(
    client,
    input.snapshot,
    input.memoryProjectionGenerationId,
    "entity",
  );
  const entityKeys = normalizeMemoryEntityProjectionKeys(input.entityKeys);
  const scope = memoryScopeStorage(input.snapshot.record.scope);
  const sourceContentHash = memoryProjectionSourceContentHash(input.snapshot);
  const builtAt = toInstant(input.builtAt);

  const inserted = await client.query<EntityProjectionRow>(
    `INSERT INTO memory.entity_projections (
       tenant_id,
       memory_projection_generation_id,
       memory_record_id,
       memory_revision_id,
       memory_type,
       scope_kind,
       scope_ref_id,
       source_content_hash,
       entity_keys,
       built_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10)
     ON CONFLICT (
       tenant_id,
       memory_projection_generation_id,
       memory_record_id
     ) DO NOTHING
     RETURNING tenant_id,
               memory_projection_generation_id,
               memory_record_id,
               memory_revision_id,
               memory_type,
               scope_kind,
               scope_ref_id,
               source_content_hash,
               entity_keys,
               built_at`,
    [
      input.snapshot.record.tenantId,
      input.memoryProjectionGenerationId,
      input.snapshot.record.memoryRecordId,
      input.snapshot.currentRevision.memoryRevisionId,
      input.snapshot.record.memoryType,
      scope.kind,
      scope.referenceId,
      sourceContentHash,
      [...entityKeys],
      builtAt,
    ],
  );

  const row =
    inserted.rows[0] ??
    (
      await client.query<EntityProjectionRow>(
        `SELECT tenant_id,
                memory_projection_generation_id,
                memory_record_id,
                memory_revision_id,
                memory_type,
                scope_kind,
                scope_ref_id,
                source_content_hash,
                entity_keys,
                built_at
           FROM memory.entity_projections
          WHERE tenant_id = $1
            AND memory_projection_generation_id = $2
            AND memory_record_id = $3`,
        [
          input.snapshot.record.tenantId,
          input.memoryProjectionGenerationId,
          input.snapshot.record.memoryRecordId,
        ],
      )
    ).rows[0];

  const reused = inserted.rows.length === 0;
  if (
    !row ||
    (reused &&
      (!sameSignalIdentity(row, input.snapshot, sourceContentHash, builtAt) ||
        JSON.stringify(row.entity_keys) !== JSON.stringify(entityKeys)))
  ) {
    throw conflict(
      "memory.projection_record_conflict",
      "Entity generation already contains a different projection for this MemoryRecord",
    );
  }
  return indexedSignal(row, reused);
}

export async function indexMemoryTemporalSnapshot(
  client: PoolClient,
  input: IndexMemoryTemporalSnapshotInput,
): Promise<IndexedMemorySignalSnapshot> {
  assertProjectableSnapshot(input.snapshot);
  await requireBuildingGeneration(
    client,
    input.snapshot,
    input.memoryProjectionGenerationId,
    "temporal",
  );
  const scope = memoryScopeStorage(input.snapshot.record.scope);
  const sourceContentHash = memoryProjectionSourceContentHash(input.snapshot);
  const builtAt = toInstant(input.builtAt);
  const revision = input.snapshot.currentRevision;

  const inserted = await client.query<TemporalProjectionRow>(
    `INSERT INTO memory.temporal_projections (
       tenant_id,
       memory_projection_generation_id,
       memory_record_id,
       memory_revision_id,
       memory_type,
       scope_kind,
       scope_ref_id,
       source_content_hash,
       event_time,
       observed_at,
       valid_from,
       valid_to,
       expires_at,
       built_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (
       tenant_id,
       memory_projection_generation_id,
       memory_record_id
     ) DO NOTHING
     RETURNING tenant_id,
               memory_projection_generation_id,
               memory_record_id,
               memory_revision_id,
               memory_type,
               scope_kind,
               scope_ref_id,
               source_content_hash,
               event_time,
               observed_at,
               valid_from,
               valid_to,
               expires_at,
               built_at`,
    [
      input.snapshot.record.tenantId,
      input.memoryProjectionGenerationId,
      input.snapshot.record.memoryRecordId,
      revision.memoryRevisionId,
      input.snapshot.record.memoryType,
      scope.kind,
      scope.referenceId,
      sourceContentHash,
      revision.eventTime,
      revision.observedAt,
      revision.validFrom,
      revision.validTo,
      revision.expiresAt,
      builtAt,
    ],
  );

  const row =
    inserted.rows[0] ??
    (
      await client.query<TemporalProjectionRow>(
        `SELECT tenant_id,
                memory_projection_generation_id,
                memory_record_id,
                memory_revision_id,
                memory_type,
                scope_kind,
                scope_ref_id,
                source_content_hash,
                event_time,
                observed_at,
                valid_from,
                valid_to,
                expires_at,
                built_at
           FROM memory.temporal_projections
          WHERE tenant_id = $1
            AND memory_projection_generation_id = $2
            AND memory_record_id = $3`,
        [
          input.snapshot.record.tenantId,
          input.memoryProjectionGenerationId,
          input.snapshot.record.memoryRecordId,
        ],
      )
    ).rows[0];

  const reused = inserted.rows.length === 0;
  const sameTemporal =
    row &&
    (row.event_time ? toInstant(row.event_time) : null) === revision.eventTime &&
    toInstant(row.observed_at) === revision.observedAt &&
    (row.valid_from ? toInstant(row.valid_from) : null) === revision.validFrom &&
    (row.valid_to ? toInstant(row.valid_to) : null) === revision.validTo &&
    (row.expires_at ? toInstant(row.expires_at) : null) === revision.expiresAt;
  if (
    !row ||
    (reused &&
      (!sameSignalIdentity(row, input.snapshot, sourceContentHash, builtAt) ||
        !sameTemporal))
  ) {
    throw conflict(
      "memory.projection_record_conflict",
      "Temporal generation already contains a different projection for this MemoryRecord",
    );
  }
  return indexedSignal(row, reused);
}

export async function searchMemoryVector(
  client: PoolClient,
  input: MemoryVectorSearchInput,
): Promise<readonly MemoryVectorHit[]> {
  assertMemoryRetrievalAdapterCapabilities(
    postgresMemoryRetrievalCapabilities,
    "vector",
  );
  const normalized = normalizeMemoryVectorSearchInput(input);
  if (normalized.compatibility.dimension > 16_000) {
    throw conflict(
      "memory.vector_dimension_unsupported",
      "PostgreSQL pgvector supports at most 16000 dimensions for this adapter",
    );
  }
  const generation = await getCurrentMemoryProjectionGeneration(
    client,
    normalized.tenantId,
    "vector",
  );
  if (!generation) {
    return Object.freeze([]);
  }
  if (!generation.vectorCompatibility) {
    throw conflict(
      "memory.vector_generation_incompatible",
      "Current vector generation has no compatibility identity",
    );
  }
  assertMemoryVectorCompatibility(
    generation.vectorCompatibility,
    normalized.compatibility,
  );
  const scopes = authorizedScopeRows(normalized.scopePredicate.scopes);
  const queryVector = vectorLiteral(normalized.queryVector);

  const result = await client.query<VectorHitRow>(
    `WITH authorized AS (
       SELECT scope_kind, scope_ref_id
         FROM jsonb_to_recordset($2::jsonb)
           AS scope(scope_kind text, scope_ref_id text)
     )
     SELECT p.tenant_id,
            p.memory_projection_generation_id,
            p.memory_record_id,
            p.memory_revision_id,
            p.memory_type,
            p.scope_kind,
            p.scope_ref_id,
            p.source_content_hash,
            p.built_at,
            v.content AS canonical_content,
            (1 - (p.embedding <=> $3::vector))::float8 AS similarity
       FROM memory.vector_projections p
       JOIN authorized scope
         ON scope.scope_kind = p.scope_kind
        AND scope.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
       JOIN memory.records r
         ON r.tenant_id = p.tenant_id
        AND r.memory_record_id = p.memory_record_id
       JOIN memory.revisions v
         ON v.tenant_id = r.tenant_id
        AND v.memory_record_id = r.memory_record_id
        AND v.revision_number = r.revision
        AND v.memory_revision_id = p.memory_revision_id
      WHERE p.tenant_id = $1
        AND p.memory_projection_generation_id = $4
        AND r.lifecycle_state = 'active'
        AND r.memory_type = p.memory_type
        AND r.scope_kind = p.scope_kind
        AND r.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
        AND (v.expires_at IS NULL OR v.expires_at > clock_timestamp())
      ORDER BY p.embedding <=> $3::vector,
               p.memory_record_id
      LIMIT $5`,
    [
      normalized.tenantId,
      JSON.stringify(scopes),
      queryVector,
      generation.memoryProjectionGenerationId,
      normalized.limit,
    ],
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        tenantId: row.tenant_id,
        memoryProjectionGenerationId: row.memory_projection_generation_id,
        memoryRecordId: row.memory_record_id,
        memoryRevisionId: row.memory_revision_id,
        memoryType: row.memory_type,
        scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
        content: row.canonical_content,
        similarity: row.similarity,
        sourceContentHash: row.source_content_hash,
      }),
    ),
  );
}

export async function searchMemoryEntity(
  client: PoolClient,
  input: MemoryEntitySearchInput,
): Promise<readonly MemoryEntityHit[]> {
  assertMemoryRetrievalAdapterCapabilities(
    postgresMemoryRetrievalCapabilities,
    "entity",
  );
  const normalized = normalizeMemoryEntitySearchInput(input);
  const generation = await getCurrentMemoryProjectionGeneration(
    client,
    normalized.tenantId,
    "entity",
  );
  if (!generation) {
    return Object.freeze([]);
  }
  const scopes = authorizedScopeRows(normalized.scopePredicate.scopes);

  const result = await client.query<EntityHitRow>(
    `WITH authorized AS (
       SELECT scope_kind, scope_ref_id
         FROM jsonb_to_recordset($2::jsonb)
           AS scope(scope_kind text, scope_ref_id text)
     ),
     candidates AS (
       SELECT p.*,
              ARRAY(
                SELECT key
                  FROM unnest(p.entity_keys) key
                 WHERE key = ANY($3::text[])
                 ORDER BY key
              ) AS matched_entity_keys
         FROM memory.entity_projections p
         JOIN authorized scope
           ON scope.scope_kind = p.scope_kind
          AND scope.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
        WHERE p.tenant_id = $1
          AND p.memory_projection_generation_id = $4
          AND p.entity_keys && $3::text[]
     )
     SELECT p.tenant_id,
            p.memory_projection_generation_id,
            p.memory_record_id,
            p.memory_revision_id,
            p.memory_type,
            p.scope_kind,
            p.scope_ref_id,
            p.source_content_hash,
            p.built_at,
            p.matched_entity_keys,
            (
              cardinality(p.matched_entity_keys)::float8 /
              cardinality($3::text[])::float8
            ) AS entity_score,
            v.content AS canonical_content
       FROM candidates p
       JOIN memory.records r
         ON r.tenant_id = p.tenant_id
        AND r.memory_record_id = p.memory_record_id
       JOIN memory.revisions v
         ON v.tenant_id = r.tenant_id
        AND v.memory_record_id = r.memory_record_id
        AND v.revision_number = r.revision
        AND v.memory_revision_id = p.memory_revision_id
      WHERE r.lifecycle_state = 'active'
        AND r.memory_type = p.memory_type
        AND r.scope_kind = p.scope_kind
        AND r.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
        AND (v.expires_at IS NULL OR v.expires_at > clock_timestamp())
      ORDER BY entity_score DESC,
               p.memory_record_id
      LIMIT $5`,
    [
      normalized.tenantId,
      JSON.stringify(scopes),
      [...normalized.entityKeys],
      generation.memoryProjectionGenerationId,
      normalized.limit,
    ],
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        tenantId: row.tenant_id,
        memoryProjectionGenerationId: row.memory_projection_generation_id,
        memoryRecordId: row.memory_record_id,
        memoryRevisionId: row.memory_revision_id,
        memoryType: row.memory_type,
        scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
        content: row.canonical_content,
        matchedEntityKeys: Object.freeze([...row.matched_entity_keys]),
        entityScore: row.entity_score,
        sourceContentHash: row.source_content_hash,
      }),
    ),
  );
}

export async function searchMemoryTemporal(
  client: PoolClient,
  input: MemoryTemporalSearchInput,
): Promise<readonly MemoryTemporalHit[]> {
  assertMemoryRetrievalAdapterCapabilities(
    postgresMemoryRetrievalCapabilities,
    "temporal",
  );
  const normalized = normalizeMemoryTemporalSearchInput(input);
  const generation = await getCurrentMemoryProjectionGeneration(
    client,
    normalized.tenantId,
    "temporal",
  );
  if (!generation) {
    return Object.freeze([]);
  }
  const scopes = authorizedScopeRows(normalized.scopePredicate.scopes);

  const result = await client.query<TemporalHitRow>(
    `WITH authorized AS (
       SELECT scope_kind, scope_ref_id
         FROM jsonb_to_recordset($2::jsonb)
           AS scope(scope_kind text, scope_ref_id text)
     )
     SELECT p.tenant_id,
            p.memory_projection_generation_id,
            p.memory_record_id,
            p.memory_revision_id,
            p.memory_type,
            p.scope_kind,
            p.scope_ref_id,
            p.source_content_hash,
            p.built_at,
            p.temporal_anchor,
            p.event_time,
            p.observed_at,
            p.valid_from,
            p.valid_to,
            p.expires_at,
            v.content AS canonical_content
       FROM memory.temporal_projections p
       JOIN authorized scope
         ON scope.scope_kind = p.scope_kind
        AND scope.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
       JOIN memory.records r
         ON r.tenant_id = p.tenant_id
        AND r.memory_record_id = p.memory_record_id
       JOIN memory.revisions v
         ON v.tenant_id = r.tenant_id
        AND v.memory_record_id = r.memory_record_id
        AND v.revision_number = r.revision
        AND v.memory_revision_id = p.memory_revision_id
      WHERE p.tenant_id = $1
        AND p.memory_projection_generation_id = $3
        AND p.temporal_anchor >= $4::timestamptz
        AND p.temporal_anchor < $5::timestamptz
        AND r.lifecycle_state = 'active'
        AND r.memory_type = p.memory_type
        AND r.scope_kind = p.scope_kind
        AND r.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
        AND p.event_time IS NOT DISTINCT FROM v.event_time
        AND p.observed_at IS NOT DISTINCT FROM v.observed_at
        AND p.valid_from IS NOT DISTINCT FROM v.valid_from
        AND p.valid_to IS NOT DISTINCT FROM v.valid_to
        AND p.expires_at IS NOT DISTINCT FROM v.expires_at
        AND (v.expires_at IS NULL OR v.expires_at > clock_timestamp())
        AND (
          $6::timestamptz IS NULL
          OR (
            (v.valid_from IS NULL OR v.valid_from <= $6::timestamptz)
            AND (v.valid_to IS NULL OR v.valid_to > $6::timestamptz)
          )
        )
      ORDER BY p.temporal_anchor DESC,
               p.memory_record_id
      LIMIT $7`,
    [
      normalized.tenantId,
      JSON.stringify(scopes),
      generation.memoryProjectionGenerationId,
      normalized.fromInclusive,
      normalized.toExclusive,
      normalized.asOf,
      normalized.limit,
    ],
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        tenantId: row.tenant_id,
        memoryProjectionGenerationId: row.memory_projection_generation_id,
        memoryRecordId: row.memory_record_id,
        memoryRevisionId: row.memory_revision_id,
        memoryType: row.memory_type,
        scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
        content: row.canonical_content,
        temporalAnchor: toInstant(row.temporal_anchor),
        eventTime: row.event_time ? toInstant(row.event_time) : null,
        observedAt: toInstant(row.observed_at),
        validFrom: row.valid_from ? toInstant(row.valid_from) : null,
        validTo: row.valid_to ? toInstant(row.valid_to) : null,
        expiresAt: row.expires_at ? toInstant(row.expires_at) : null,
        sourceContentHash: row.source_content_hash,
      }),
    ),
  );
}
