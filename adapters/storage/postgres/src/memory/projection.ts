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
  memoryProjectionSourceContentHash,
  memoryScopeFromStorage,
  memoryScopeStorage,
  normalizeMemoryLexicalSearchInput,
  normalizeMemoryProjectionGenerationInput,
  type CreateMemoryProjectionGenerationInput,
  type MemoryLexicalHit,
  type MemoryLexicalSearchInput,
  type MemoryProjectionGeneration,
  type MemoryProjectionGenerationState,
  type MemoryProjectionKind,
  type MemoryRecordSnapshot,
  type MemoryScopeKind,
  type MemoryType,
} from "@masanawa/memory";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface ProjectionGenerationRow {
  tenant_id: TenantId;
  memory_projection_generation_id: MemoryProjectionGenerationId;
  kind: MemoryProjectionKind;
  implementation_key: string;
  schema_version: number;
  vector_provider_key: string | null;
  vector_model_key: string | null;
  vector_dimension: number | null;
  state: MemoryProjectionGenerationState;
  created_at: Date;
  activated_at: Date | null;
  retired_at: Date | null;
}

interface LexicalProjectionRow {
  tenant_id: TenantId;
  memory_projection_generation_id: MemoryProjectionGenerationId;
  memory_record_id: MemoryRecordId;
  memory_revision_id: MemoryRevisionId;
  memory_type: MemoryType;
  scope_kind: MemoryScopeKind;
  scope_ref_id: string | null;
  source_content_hash: string;
  document_text: string;
  built_at: Date;
}

interface LexicalHitRow extends LexicalProjectionRow {
  lexical_rank: number;
  canonical_content: string;
}

export interface IndexMemoryLexicalSnapshotInput {
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly snapshot: MemoryRecordSnapshot;
  readonly builtAt: Instant;
}

export interface IndexedMemoryLexicalSnapshot {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly sourceContentHash: string;
  readonly builtAt: Instant;
  readonly reused: boolean;
}

export interface ActivateMemoryProjectionGenerationInput {
  readonly tenantId: TenantId;
  readonly memoryProjectionGenerationId: MemoryProjectionGenerationId;
  readonly activatedAt: Instant;
}

export const postgresMemoryRetrievalCapabilities = Object.freeze({
  exactScopeFiltering: true,
  lexical: true,
  vector: true,
  entity: true,
  temporal: true,
});

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function generationFromRow(
  row: ProjectionGenerationRow,
): MemoryProjectionGeneration {
  return Object.freeze({
    tenantId: row.tenant_id,
    memoryProjectionGenerationId: row.memory_projection_generation_id,
    kind: row.kind,
    implementationKey: row.implementation_key,
    schemaVersion: row.schema_version,
    vectorCompatibility:
      row.vector_provider_key === null ||
      row.vector_model_key === null ||
      row.vector_dimension === null
        ? null
        : Object.freeze({
            providerKey: row.vector_provider_key,
            modelKey: row.vector_model_key,
            dimension: row.vector_dimension,
          }),
    state: row.state,
    createdAt: toInstant(row.created_at),
    activatedAt: row.activated_at ? toInstant(row.activated_at) : null,
    retiredAt: row.retired_at ? toInstant(row.retired_at) : null,
  });
}

const generationSelect = `
  SELECT tenant_id,
         memory_projection_generation_id,
         kind,
         implementation_key,
         schema_version,
         vector_provider_key,
         vector_model_key,
         vector_dimension,
         state,
         created_at,
         activated_at,
         retired_at
    FROM memory.projection_generations
`;

async function loadProjectionGeneration(
  client: PoolClient,
  tenantId: TenantId,
  memoryProjectionGenerationId: MemoryProjectionGenerationId,
  lock = false,
): Promise<MemoryProjectionGeneration | null> {
  const result = await client.query<ProjectionGenerationRow>(
    `${generationSelect}
      WHERE tenant_id = $1
        AND memory_projection_generation_id = $2
      ${lock ? "FOR UPDATE" : ""}`,
    [tenantId, memoryProjectionGenerationId],
  );
  return result.rows[0] ? generationFromRow(result.rows[0]) : null;
}

function sameGenerationIdentity(
  generation: MemoryProjectionGeneration,
  input: ReturnType<typeof normalizeMemoryProjectionGenerationInput>,
): boolean {
  return (
    generation.kind === input.kind &&
    generation.implementationKey === input.implementationKey &&
    generation.schemaVersion === input.schemaVersion &&
    generation.createdAt === input.createdAt &&
    JSON.stringify(generation.vectorCompatibility) ===
      JSON.stringify(input.vectorCompatibility ?? null)
  );
}

export async function createMemoryProjectionGeneration(
  client: PoolClient,
  input: CreateMemoryProjectionGenerationInput,
): Promise<MemoryProjectionGeneration> {
  const normalized = normalizeMemoryProjectionGenerationInput(input);
  const vector = normalized.vectorCompatibility ?? null;
  const inserted = await client.query<ProjectionGenerationRow>(
    `INSERT INTO memory.projection_generations (
       tenant_id,
       memory_projection_generation_id,
       kind,
       implementation_key,
       schema_version,
       vector_provider_key,
       vector_model_key,
       vector_dimension,
       state,
       created_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'building',$9)
     ON CONFLICT (tenant_id, memory_projection_generation_id) DO NOTHING
     RETURNING tenant_id,
               memory_projection_generation_id,
               kind,
               implementation_key,
               schema_version,
               vector_provider_key,
               vector_model_key,
               vector_dimension,
               state,
               created_at,
               activated_at,
               retired_at`,
    [
      normalized.tenantId,
      normalized.memoryProjectionGenerationId,
      normalized.kind,
      normalized.implementationKey,
      normalized.schemaVersion,
      vector?.providerKey ?? null,
      vector?.modelKey ?? null,
      vector?.dimension ?? null,
      normalized.createdAt,
    ],
  );

  if (inserted.rows[0]) {
    return generationFromRow(inserted.rows[0]);
  }

  const existing = await loadProjectionGeneration(
    client,
    normalized.tenantId,
    normalized.memoryProjectionGenerationId,
  );
  if (!existing) {
    throw new Error(
      "Projection generation conflict completed without a readable row",
    );
  }
  if (!sameGenerationIdentity(existing, normalized)) {
    throw conflict(
      "memory.projection_generation_id_conflict",
      "Memory projection generation identity was already used for different compatibility metadata",
    );
  }
  return existing;
}

export async function getMemoryProjectionGeneration(
  client: PoolClient,
  tenantId: TenantId,
  memoryProjectionGenerationId: MemoryProjectionGenerationId,
): Promise<MemoryProjectionGeneration | null> {
  return loadProjectionGeneration(
    client,
    tenantId,
    memoryProjectionGenerationId,
  );
}

export async function getCurrentMemoryProjectionGeneration(
  client: PoolClient,
  tenantId: TenantId,
  kind: MemoryProjectionKind,
): Promise<MemoryProjectionGeneration | null> {
  const result = await client.query<ProjectionGenerationRow>(
    `${generationSelect}
      WHERE tenant_id = $1
        AND kind = $2
        AND state = 'current'`,
    [tenantId, kind],
  );
  return result.rows[0] ? generationFromRow(result.rows[0]) : null;
}

function lexicalProjectionMatches(
  row: LexicalProjectionRow,
  input: IndexMemoryLexicalSnapshotInput,
  sourceContentHash: string,
): boolean {
  const storage = memoryScopeStorage(input.snapshot.record.scope);
  return (
    row.memory_revision_id ===
      input.snapshot.currentRevision.memoryRevisionId &&
    row.memory_type === input.snapshot.record.memoryType &&
    row.scope_kind === storage.kind &&
    row.scope_ref_id === storage.referenceId &&
    row.source_content_hash === sourceContentHash &&
    row.document_text === input.snapshot.currentRevision.content &&
    toInstant(row.built_at) === toInstant(input.builtAt)
  );
}

export async function indexMemoryLexicalSnapshot(
  client: PoolClient,
  input: IndexMemoryLexicalSnapshotInput,
): Promise<IndexedMemoryLexicalSnapshot> {
  const snapshot = input.snapshot;
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

  const storage = memoryScopeStorage(snapshot.record.scope);
  const sourceContentHash = memoryProjectionSourceContentHash(snapshot);
  const builtAt = toInstant(input.builtAt);

  const inserted = await client.query<LexicalProjectionRow>(
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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
               document_text,
               built_at`,
    [
      snapshot.record.tenantId,
      input.memoryProjectionGenerationId,
      snapshot.record.memoryRecordId,
      snapshot.currentRevision.memoryRevisionId,
      snapshot.record.memoryType,
      storage.kind,
      storage.referenceId,
      sourceContentHash,
      snapshot.currentRevision.content,
      builtAt,
    ],
  );

  const row =
    inserted.rows[0] ??
    (
      await client.query<LexicalProjectionRow>(
        `SELECT tenant_id,
                memory_projection_generation_id,
                memory_record_id,
                memory_revision_id,
                memory_type,
                scope_kind,
                scope_ref_id,
                source_content_hash,
                document_text,
                built_at
           FROM memory.lexical_projections
          WHERE tenant_id = $1
            AND memory_projection_generation_id = $2
            AND memory_record_id = $3`,
        [
          snapshot.record.tenantId,
          input.memoryProjectionGenerationId,
          snapshot.record.memoryRecordId,
        ],
      )
    ).rows[0];

  if (!row) {
    throw new Error(
      "Lexical projection insert completed without a readable row",
    );
  }
  const reused = inserted.rows.length === 0;
  if (
    reused &&
    !lexicalProjectionMatches(row, input, sourceContentHash)
  ) {
    throw conflict(
      "memory.projection_record_conflict",
      "Projection generation already contains a different canonical revision for this MemoryRecord",
    );
  }

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

function projectionTableForKind(kind: MemoryProjectionKind): string {
  switch (kind) {
    case "lexical":
      return "lexical_projections";
    case "vector":
      return "vector_projections";
    case "entity":
      return "entity_projections";
    case "temporal":
      return "temporal_projections";
  }
}

function projectionCurrentMatchSql(kind: MemoryProjectionKind): string {
  if (kind === "lexical") {
    return "AND p.document_text = v.content";
  }
  if (kind === "temporal") {
    return `AND p.event_time IS NOT DISTINCT FROM v.event_time
            AND p.observed_at IS NOT DISTINCT FROM v.observed_at
            AND p.valid_from IS NOT DISTINCT FROM v.valid_from
            AND p.valid_to IS NOT DISTINCT FROM v.valid_to
            AND p.expires_at IS NOT DISTINCT FROM v.expires_at`;
  }
  return "";
}

function projectionStaleSql(kind: MemoryProjectionKind): string {
  if (kind === "lexical") {
    return "OR v.content IS DISTINCT FROM p.document_text";
  }
  if (kind === "temporal") {
    return `OR v.event_time IS DISTINCT FROM p.event_time
              OR v.observed_at IS DISTINCT FROM p.observed_at
              OR v.valid_from IS DISTINCT FROM p.valid_from
              OR v.valid_to IS DISTINCT FROM p.valid_to
              OR v.expires_at IS DISTINCT FROM p.expires_at`;
  }
  return "";
}

async function assertCompleteProjectionGeneration(
  client: PoolClient,
  tenantId: TenantId,
  memoryProjectionGenerationId: MemoryProjectionGenerationId,
  kind: MemoryProjectionKind,
): Promise<void> {
  const table = projectionTableForKind(kind);
  const currentMatch = projectionCurrentMatchSql(kind);
  const staleMatch = projectionStaleSql(kind);
  const result = await client.query<{ missing: string; stale: string }>(
    `SELECT
       (
         SELECT count(*)::text
           FROM memory.records r
           JOIN memory.revisions v
             ON v.tenant_id = r.tenant_id
            AND v.memory_record_id = r.memory_record_id
            AND v.revision_number = r.revision
          WHERE r.tenant_id = $1
            AND r.lifecycle_state = 'active'
            AND NOT EXISTS (
              SELECT 1
                FROM memory.${table} p
               WHERE p.tenant_id = r.tenant_id
                 AND p.memory_projection_generation_id = $2
                 AND p.memory_record_id = r.memory_record_id
                 AND p.memory_revision_id = v.memory_revision_id
                 AND p.memory_type = r.memory_type
                 AND p.scope_kind = r.scope_kind
                 AND p.scope_ref_id IS NOT DISTINCT FROM r.scope_ref_id
                 ${currentMatch}
            )
       ) AS missing,
       (
         SELECT count(*)::text
           FROM memory.${table} p
           LEFT JOIN memory.records r
             ON r.tenant_id = p.tenant_id
            AND r.memory_record_id = p.memory_record_id
           LEFT JOIN memory.revisions v
             ON v.tenant_id = r.tenant_id
            AND v.memory_record_id = r.memory_record_id
            AND v.revision_number = r.revision
          WHERE p.tenant_id = $1
            AND p.memory_projection_generation_id = $2
            AND (
              r.memory_record_id IS NULL
              OR r.lifecycle_state <> 'active'
              OR v.memory_revision_id IS DISTINCT FROM p.memory_revision_id
              OR r.memory_type IS DISTINCT FROM p.memory_type
              OR r.scope_kind IS DISTINCT FROM p.scope_kind
              OR r.scope_ref_id IS DISTINCT FROM p.scope_ref_id
              ${staleMatch}
            )
       ) AS stale`,
    [tenantId, memoryProjectionGenerationId],
  );

  const missing = Number(result.rows[0]?.missing ?? "0");
  const stale = Number(result.rows[0]?.stale ?? "0");
  if (
    !Number.isSafeInteger(missing) ||
    !Number.isSafeInteger(stale) ||
    missing < 0 ||
    stale < 0
  ) {
    throw new Error("PostgreSQL returned invalid projection completeness counts");
  }
  if (missing !== 0 || stale !== 0) {
    throw conflict(
      "memory.projection_generation_incomplete",
      "Projection generation is incomplete or stale against canonical current memory",
    );
  }
}

export async function activateMemoryProjectionGeneration(
  pool: Pool,
  input: ActivateMemoryProjectionGenerationInput,
): Promise<MemoryProjectionGeneration> {
  const activatedAt = toInstant(input.activatedAt);

  return withTransaction(
    pool,
    async (client) => {
      let generation = await loadProjectionGeneration(
        client,
        input.tenantId,
        input.memoryProjectionGenerationId,
        true,
      );
      if (!generation) {
        throw new PlatformError({
          code: "memory.projection_generation_not_found",
          category: "not-found",
          message: "Memory projection generation was not found",
          retryable: false,
        });
      }
      if (generation.state === "current") {
        return generation;
      }
      if (generation.state === "retired") {
        throw conflict(
          "memory.projection_generation_retired",
          "A retired projection generation cannot become current again",
        );
      }
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`memory-projection:${input.tenantId}:${generation.kind}`],
      );

      generation = await loadProjectionGeneration(
        client,
        input.tenantId,
        input.memoryProjectionGenerationId,
        true,
      );
      if (!generation) {
        throw new Error("Projection generation disappeared during activation");
      }
      if (generation.state === "current") {
        return generation;
      }
      if (generation.state !== "building") {
        throw conflict(
          "memory.projection_generation_not_building",
          "Only a building projection generation can become current",
        );
      }

      await assertCompleteProjectionGeneration(
        client,
        input.tenantId,
        input.memoryProjectionGenerationId,
        generation.kind,
      );

      await client.query(
        `UPDATE memory.projection_generations
            SET state = 'retired',
                retired_at = GREATEST($3::timestamptz, activated_at)
          WHERE tenant_id = $1
            AND kind = $2
            AND state = 'current'
            AND memory_projection_generation_id <> $4`,
        [
          input.tenantId,
          generation.kind,
          activatedAt,
          input.memoryProjectionGenerationId,
        ],
      );

      await client.query(
        `UPDATE memory.projection_generations
            SET state = 'current',
                activated_at = $3
          WHERE tenant_id = $1
            AND memory_projection_generation_id = $2
            AND state = 'building'`,
        [
          input.tenantId,
          input.memoryProjectionGenerationId,
          activatedAt,
        ],
      );

      const activated = await loadProjectionGeneration(
        client,
        input.tenantId,
        input.memoryProjectionGenerationId,
      );
      if (!activated || activated.state !== "current") {
        throw new Error(
          "Projection generation activation completed without current state",
        );
      }
      return activated;
    },
    { isolation: "serializable" },
  );
}

export async function searchMemoryLexical(
  client: PoolClient,
  input: MemoryLexicalSearchInput,
): Promise<readonly MemoryLexicalHit[]> {
  assertMemoryRetrievalAdapterCapabilities(
    postgresMemoryRetrievalCapabilities,
    "lexical",
  );
  const normalized = normalizeMemoryLexicalSearchInput(input);
  const authorizedScopes = normalized.scopePredicate.scopes.map((scope) => {
    const storage = memoryScopeStorage(scope);
    return {
      scope_kind: storage.kind,
      scope_ref_id: storage.referenceId,
    };
  });

  const result = await client.query<LexicalHitRow>(
    `WITH authorized AS (
       SELECT scope_kind, scope_ref_id
         FROM jsonb_to_recordset($2::jsonb)
           AS scope(scope_kind text, scope_ref_id text)
     ),
     current_generation AS (
       SELECT memory_projection_generation_id
         FROM memory.projection_generations
        WHERE tenant_id = $1
          AND kind = 'lexical'
          AND state = 'current'
     ),
     lexical_query AS (
       SELECT websearch_to_tsquery('simple', $3) AS query
     )
     SELECT p.tenant_id,
            p.memory_projection_generation_id,
            p.memory_record_id,
            p.memory_revision_id,
            p.memory_type,
            p.scope_kind,
            p.scope_ref_id,
            p.source_content_hash,
            p.document_text,
            p.built_at,
            v.content AS canonical_content,
            ts_rank_cd(p.search_document, lexical_query.query)::float8
              AS lexical_rank
       FROM memory.lexical_projections p
       JOIN current_generation generation
         ON generation.memory_projection_generation_id =
            p.memory_projection_generation_id
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
       CROSS JOIN lexical_query
      WHERE p.tenant_id = $1
        AND r.lifecycle_state = 'active'
        AND r.memory_type = p.memory_type
        AND r.scope_kind = p.scope_kind
        AND r.scope_ref_id IS NOT DISTINCT FROM p.scope_ref_id
        AND p.document_text = v.content
        AND (v.expires_at IS NULL OR v.expires_at > clock_timestamp())
        AND p.search_document @@ lexical_query.query
      ORDER BY lexical_rank DESC,
               p.memory_record_id
      LIMIT $4`,
    [
      normalized.tenantId,
      JSON.stringify(authorizedScopes),
      normalized.query,
      normalized.limit,
    ],
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        tenantId: row.tenant_id,
        memoryProjectionGenerationId:
          row.memory_projection_generation_id,
        memoryRecordId: row.memory_record_id,
        memoryRevisionId: row.memory_revision_id,
        memoryType: row.memory_type,
        scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
        content: row.canonical_content,
        lexicalRank: row.lexical_rank,
        sourceContentHash: row.source_content_hash,
      }),
    ),
  );
}
