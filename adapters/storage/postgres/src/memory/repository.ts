import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type MemoryRecordId,
  type MemoryRevisionId,
  type TenantId,
} from "@masanawa/contracts";
import {
  memoryLifecycleStates,
  memoryScopeKey,
  memoryScopeStorage,
  normalizeMemoryRevisionContent,
  normalizeMemoryScope,
  normalizeMemoryType,
  type AppendMemoryRevisionInput,
  type CreateMemoryRecordInput,
  type GetMemoryRecordInScopeInput,
  type JsonObject,
  type LinkMemoryRecordsInput,
  type LinkedMemoryRecords,
  type ListMemoryRecordsByScopesInput,
  type MemoryEvidence,
  type MemoryLifecycleState,
  type MemoryRecord,
  type MemoryRecordSnapshot,
  type MemoryRepository,
  type MemoryRevision,
  type MemoryScope,
  type MemoryScopeKind,
  type MemoryType,
  type NormalizedMemoryRevisionContent,
} from "@masanawa/memory";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { PoolClient } from "pg";

interface SnapshotRow {
  tenant_id: TenantId;
  memory_record_id: MemoryRecordId;
  memory_type: MemoryType;
  scope_kind: MemoryScopeKind;
  scope_ref_id: string | null;
  lifecycle_state: MemoryLifecycleState;
  record_revision: string;
  lifecycle_revision: string;
  record_created_at: Date;
  record_updated_at: Date;
  memory_revision_id: MemoryRevisionId;
  revision_number: string;
  content: string;
  payload: JsonObject;
  confidence: number;
  extraction_method: string;
  extraction_model_version: string | null;
  event_time: Date | null;
  observed_at: Date;
  valid_from: Date | null;
  valid_to: Date | null;
  expires_at: Date | null;
  revision_created_at: Date;
}

interface EvidenceRow {
  tenant_id: TenantId;
  memory_revision_id: MemoryRevisionId;
  ordinal: number;
  source_kind: MemoryEvidence["sourceKind"];
  source_reference: string;
  source_content_hash: string;
  verbatim_text: string | null;
  observed_at: Date;
}

const lifecycleStateSet = new Set<string>(memoryLifecycleStates);

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function missing(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "not-found",
    message,
    retryable: false,
  });
}

function positiveRevision(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid memory revision returned by PostgreSQL");
  }
  return parsed;
}

function scopeFromStorage(
  kind: MemoryScopeKind,
  referenceId: string | null,
): MemoryScope {
  switch (kind) {
    case "organization":
      if (referenceId !== null) {
        throw new Error("Organization memory scope unexpectedly has a reference");
      }
      return Object.freeze({ kind });
    case "relationship":
      if (referenceId === null) throw new Error("Relationship scope reference missing");
      return Object.freeze({
        kind,
        relationshipId: parseCanonicalId("relationship", referenceId),
      });
    case "character-private":
    case "character-shared":
      if (referenceId === null) throw new Error("Character scope reference missing");
      return Object.freeze({
        kind,
        characterId: parseCanonicalId("character", referenceId),
      });
    case "world":
      if (referenceId === null) throw new Error("World scope reference missing");
      return Object.freeze({
        kind,
        worldId: parseCanonicalId("world", referenceId),
      });
    case "session":
      if (referenceId === null) throw new Error("Session scope reference missing");
      return Object.freeze({
        kind,
        characterSessionId: parseCanonicalId("character-session", referenceId),
      });
    case "task":
      if (referenceId === null) throw new Error("Task scope reference missing");
      return Object.freeze({
        kind,
        taskId: parseCanonicalId("task", referenceId),
      });
  }
}

function evidenceFromRow(row: EvidenceRow): MemoryEvidence {
  return Object.freeze({
    ordinal: row.ordinal,
    sourceKind: row.source_kind,
    sourceReference: row.source_reference,
    sourceContentHash: row.source_content_hash,
    verbatimText: row.verbatim_text,
    observedAt: toInstant(row.observed_at),
  });
}

async function loadEvidenceByRevision(
  client: PoolClient,
  tenantId: TenantId,
  revisionIds: readonly MemoryRevisionId[],
): Promise<ReadonlyMap<MemoryRevisionId, readonly MemoryEvidence[]>> {
  const result = new Map<MemoryRevisionId, MemoryEvidence[]>();
  if (revisionIds.length === 0) return result;

  const rows = await client.query<EvidenceRow>(
    `SELECT tenant_id, memory_revision_id, ordinal, source_kind,
            source_reference, source_content_hash, verbatim_text, observed_at
       FROM memory.evidence
      WHERE tenant_id = $1
        AND memory_revision_id = ANY($2::text[])
      ORDER BY memory_revision_id, ordinal`,
    [tenantId, revisionIds],
  );

  for (const row of rows.rows) {
    const bucket = result.get(row.memory_revision_id) ?? [];
    bucket.push(evidenceFromRow(row));
    result.set(row.memory_revision_id, bucket);
  }

  return new Map(
    [...result].map(([revisionId, evidence]) => [
      revisionId,
      Object.freeze([...evidence]),
    ]),
  );
}

async function snapshotsFromRows(
  client: PoolClient,
  rows: readonly SnapshotRow[],
): Promise<readonly MemoryRecordSnapshot[]> {
  if (rows.length === 0) return Object.freeze([]);

  const tenantId = rows[0]!.tenant_id;
  if (rows.some((row) => row.tenant_id !== tenantId)) {
    throw new Error("Memory snapshot query crossed tenant boundaries");
  }

  const evidence = await loadEvidenceByRevision(
    client,
    tenantId,
    rows.map((row) => row.memory_revision_id),
  );

  return Object.freeze(
    rows.map((row) => {
      const currentEvidence = evidence.get(row.memory_revision_id) ?? [];
      if (currentEvidence.length === 0) {
        throw new Error("Canonical memory revision has no provenance evidence");
      }

      const record: MemoryRecord = Object.freeze({
        tenantId: row.tenant_id,
        memoryRecordId: row.memory_record_id,
        memoryType: row.memory_type,
        scope: scopeFromStorage(row.scope_kind, row.scope_ref_id),
        lifecycleState: row.lifecycle_state,
        currentRevisionId: row.memory_revision_id,
        revision: positiveRevision(row.record_revision),
        lifecycleRevision: positiveRevision(row.lifecycle_revision),
        createdAt: toInstant(row.record_created_at),
        updatedAt: toInstant(row.record_updated_at),
      });

      const revision: MemoryRevision = Object.freeze({
        tenantId: row.tenant_id,
        memoryRevisionId: row.memory_revision_id,
        memoryRecordId: row.memory_record_id,
        revisionNumber: positiveRevision(row.revision_number),
        content: row.content,
        payload: Object.freeze({ ...row.payload }),
        confidence: row.confidence,
        extraction: Object.freeze({
          method: row.extraction_method,
          modelVersion: row.extraction_model_version,
        }),
        eventTime: row.event_time ? toInstant(row.event_time) : null,
        observedAt: toInstant(row.observed_at),
        validFrom: row.valid_from ? toInstant(row.valid_from) : null,
        validTo: row.valid_to ? toInstant(row.valid_to) : null,
        expiresAt: row.expires_at ? toInstant(row.expires_at) : null,
        createdAt: toInstant(row.revision_created_at),
        evidence: currentEvidence,
      });

      return Object.freeze({
        record,
        currentRevision: revision,
      });
    }),
  );
}

const snapshotSelect = `
  SELECT
    r.tenant_id,
    r.memory_record_id,
    r.memory_type,
    r.scope_kind,
    r.scope_ref_id,
    r.lifecycle_state,
    r.revision::text AS record_revision,
    r.lifecycle_revision::text AS lifecycle_revision,
    r.created_at AS record_created_at,
    r.updated_at AS record_updated_at,
    v.memory_revision_id,
    v.revision_number::text AS revision_number,
    v.content,
    v.payload,
    v.confidence,
    v.extraction_method,
    v.extraction_model_version,
    v.event_time,
    v.observed_at,
    v.valid_from,
    v.valid_to,
    v.expires_at,
    v.created_at AS revision_created_at
  FROM memory.records r
  JOIN memory.revisions v
    ON v.tenant_id = r.tenant_id
   AND v.memory_record_id = r.memory_record_id
   AND v.revision_number = r.revision
`;

async function loadSnapshot(
  client: PoolClient,
  tenantId: TenantId,
  memoryRecordId: MemoryRecordId,
): Promise<MemoryRecordSnapshot | null> {
  const rows = await client.query<SnapshotRow>(
    `${snapshotSelect}
      WHERE r.tenant_id = $1
        AND r.memory_record_id = $2`,
    [tenantId, memoryRecordId],
  );
  return (await snapshotsFromRows(client, rows.rows))[0] ?? null;
}

function evidenceJson(normalized: NormalizedMemoryRevisionContent): string {
  return JSON.stringify(
    normalized.evidence.map((item) => ({
      ordinal: item.ordinal,
      source_kind: item.sourceKind,
      source_reference: item.sourceReference,
      source_content_hash: item.sourceContentHash,
      verbatim_text: item.verbatimText,
      observed_at: item.observedAt,
    })),
  );
}

function revisionFingerprint(
  revision: MemoryRevision,
): string {
  return fingerprintCanonicalJson({
    content: revision.content,
    payload: revision.payload,
    confidence: revision.confidence,
    extraction: revision.extraction,
    eventTime: revision.eventTime,
    observedAt: revision.observedAt,
    validFrom: revision.validFrom,
    validTo: revision.validTo,
    expiresAt: revision.expiresAt,
    createdAt: revision.createdAt,
    evidence: revision.evidence,
  });
}

function normalizedRevisionFingerprint(
  normalized: NormalizedMemoryRevisionContent,
  createdAt: string,
): string {
  return fingerprintCanonicalJson({
    content: normalized.content,
    payload: normalized.payload,
    confidence: normalized.confidence,
    extraction: normalized.extraction,
    eventTime: normalized.eventTime,
    observedAt: normalized.observedAt,
    validFrom: normalized.validFrom,
    validTo: normalized.validTo,
    expiresAt: normalized.expiresAt,
    createdAt,
    evidence: normalized.evidence,
  });
}

function exactReplay(
  snapshot: MemoryRecordSnapshot,
  memoryRevisionId: MemoryRevisionId,
  normalized: NormalizedMemoryRevisionContent,
  createdAt: string,
): boolean {
  return (
    snapshot.currentRevision.memoryRevisionId === memoryRevisionId &&
    revisionFingerprint(snapshot.currentRevision) ===
      normalizedRevisionFingerprint(normalized, createdAt)
  );
}

export async function createMemoryRecord(
  client: PoolClient,
  input: CreateMemoryRecordInput,
): Promise<MemoryRecordSnapshot> {
  const memoryType = normalizeMemoryType(input.memoryType);
  const scope = normalizeMemoryScope(input.scope);
  const storage = memoryScopeStorage(scope);
  const normalized = normalizeMemoryRevisionContent(input);
  const createdAt = toInstant(input.createdAt);

  const result = await client.query<{ inserted: string }>(
    `WITH inserted_record AS (
       INSERT INTO memory.records (
         tenant_id,
         memory_record_id,
         memory_type,
         scope_kind,
         scope_ref_id,
         lifecycle_state,
         revision,
         created_at,
         updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'active',1,$6,$6)
       ON CONFLICT (tenant_id, memory_record_id) DO NOTHING
       RETURNING tenant_id, memory_record_id
     ),
     inserted_revision AS (
       INSERT INTO memory.revisions (
         tenant_id,
         memory_revision_id,
         memory_record_id,
         revision_number,
         content,
         payload,
         confidence,
         extraction_method,
         extraction_model_version,
         event_time,
         observed_at,
         valid_from,
         valid_to,
         expires_at,
         created_at
       )
       SELECT
         tenant_id,
         $7,
         memory_record_id,
         1,
         $8,
         $9::jsonb,
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17,
         $6
       FROM inserted_record
       RETURNING tenant_id, memory_revision_id
     ),
     inserted_evidence AS (
       INSERT INTO memory.evidence (
         tenant_id,
         memory_revision_id,
         ordinal,
         source_kind,
         source_reference,
         source_content_hash,
         verbatim_text,
         observed_at
       )
       SELECT
         revision.tenant_id,
         revision.memory_revision_id,
         evidence.ordinal,
         evidence.source_kind,
         evidence.source_reference,
         evidence.source_content_hash,
         evidence.verbatim_text,
         evidence.observed_at
       FROM inserted_revision revision
       CROSS JOIN jsonb_to_recordset($18::jsonb) AS evidence(
         ordinal integer,
         source_kind text,
         source_reference text,
         source_content_hash text,
         verbatim_text text,
         observed_at timestamptz
       )
       RETURNING 1
     )
     SELECT count(*)::text AS inserted FROM inserted_revision`,
    [
      input.tenantId,
      input.memoryRecordId,
      memoryType,
      storage.kind,
      storage.referenceId,
      createdAt,
      input.memoryRevisionId,
      normalized.content,
      JSON.stringify(normalized.payload),
      normalized.confidence,
      normalized.extraction.method,
      normalized.extraction.modelVersion,
      normalized.eventTime,
      normalized.observedAt,
      normalized.validFrom,
      normalized.validTo,
      normalized.expiresAt,
      evidenceJson(normalized),
    ],
  );

  const snapshot = await loadSnapshot(
    client,
    input.tenantId,
    input.memoryRecordId,
  );
  if (!snapshot) {
    throw new Error("Memory record insert completed without a readable snapshot");
  }

  if (result.rows[0]?.inserted === "0") {
    if (
      snapshot.record.memoryType === memoryType &&
      memoryScopeKey(snapshot.record.scope) === memoryScopeKey(scope) &&
      exactReplay(
        snapshot,
        input.memoryRevisionId,
        normalized,
        createdAt,
      )
    ) {
      return snapshot;
    }
    throw conflict(
      "memory.record_id_conflict",
      "MemoryRecord identity was already used for different canonical content",
    );
  }

  return snapshot;
}

export async function appendMemoryRevision(
  client: PoolClient,
  input: AppendMemoryRevisionInput,
): Promise<MemoryRecordSnapshot> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new RangeError("expectedRevision must be a positive safe integer");
  }

  const normalized = normalizeMemoryRevisionContent(input);
  const updatedAt = toInstant(input.updatedAt);

  const result = await client.query<{ updated: string }>(
    `WITH locked_record AS (
       SELECT tenant_id, memory_record_id, revision
       FROM memory.records
       WHERE tenant_id = $1
         AND memory_record_id = $2
         AND lifecycle_state = 'active'
         AND revision = $3
       FOR UPDATE
     ),
     inserted_revision AS (
       INSERT INTO memory.revisions (
         tenant_id,
         memory_revision_id,
         memory_record_id,
         revision_number,
         content,
         payload,
         confidence,
         extraction_method,
         extraction_model_version,
         event_time,
         observed_at,
         valid_from,
         valid_to,
         expires_at,
         created_at
       )
       SELECT
         tenant_id,
         $4,
         memory_record_id,
         revision + 1,
         $5,
         $6::jsonb,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13,
         $14,
         $15
       FROM locked_record
       RETURNING tenant_id, memory_revision_id, memory_record_id, revision_number
     ),
     inserted_evidence AS (
       INSERT INTO memory.evidence (
         tenant_id,
         memory_revision_id,
         ordinal,
         source_kind,
         source_reference,
         source_content_hash,
         verbatim_text,
         observed_at
       )
       SELECT
         revision.tenant_id,
         revision.memory_revision_id,
         evidence.ordinal,
         evidence.source_kind,
         evidence.source_reference,
         evidence.source_content_hash,
         evidence.verbatim_text,
         evidence.observed_at
       FROM inserted_revision revision
       CROSS JOIN jsonb_to_recordset($16::jsonb) AS evidence(
         ordinal integer,
         source_kind text,
         source_reference text,
         source_content_hash text,
         verbatim_text text,
         observed_at timestamptz
       )
       RETURNING 1
     ),
     updated_record AS (
       UPDATE memory.records record
       SET revision = revision.revision_number,
           updated_at = $15
       FROM inserted_revision revision
       WHERE record.tenant_id = revision.tenant_id
         AND record.memory_record_id = revision.memory_record_id
         AND record.revision = $3
       RETURNING record.memory_record_id
     )
     SELECT count(*)::text AS updated FROM updated_record`,
    [
      input.tenantId,
      input.memoryRecordId,
      input.expectedRevision,
      input.memoryRevisionId,
      normalized.content,
      JSON.stringify(normalized.payload),
      normalized.confidence,
      normalized.extraction.method,
      normalized.extraction.modelVersion,
      normalized.eventTime,
      normalized.observedAt,
      normalized.validFrom,
      normalized.validTo,
      normalized.expiresAt,
      updatedAt,
      evidenceJson(normalized),
    ],
  );

  const snapshot = await loadSnapshot(
    client,
    input.tenantId,
    input.memoryRecordId,
  );
  if (!snapshot) {
    throw missing("memory.record_not_found", "MemoryRecord was not found");
  }

  if (result.rows[0]?.updated !== "1") {
    if (
      exactReplay(
        snapshot,
        input.memoryRevisionId,
        normalized,
        updatedAt,
      )
    ) {
      return snapshot;
    }
    if (snapshot.record.lifecycleState !== "active") {
      throw conflict(
        "memory.record_not_active",
        "Only an active MemoryRecord can receive a new revision",
      );
    }
    throw conflict(
      "memory.revision_conflict",
      "MemoryRecord revision is stale",
    );
  }

  return snapshot;
}

export async function getMemoryRecordInScope(
  client: PoolClient,
  input: GetMemoryRecordInScopeInput,
): Promise<MemoryRecordSnapshot | null> {
  const storage = memoryScopeStorage(input.scope);
  const rows = await client.query<SnapshotRow>(
    `${snapshotSelect}
      WHERE r.tenant_id = $1
        AND r.memory_record_id = $2
        AND r.scope_kind = $3
        AND r.scope_ref_id IS NOT DISTINCT FROM $4`,
    [
      input.tenantId,
      input.memoryRecordId,
      storage.kind,
      storage.referenceId,
    ],
  );
  return (await snapshotsFromRows(client, rows.rows))[0] ?? null;
}

export async function listMemoryRecordsByScopes(
  client: PoolClient,
  input: ListMemoryRecordsByScopesInput,
): Promise<readonly MemoryRecordSnapshot[]> {
  if (!Array.isArray(input.scopes) || input.scopes.length < 1) {
    return Object.freeze([]);
  }
  if (input.scopes.length > 64) {
    throw new RangeError("At most 64 memory scopes may be queried at once");
  }

  const scopes = [
    ...new Map(
      input.scopes.map((scope) => {
        const normalized = normalizeMemoryScope(scope);
        return [memoryScopeKey(normalized), normalized] as const;
      }),
    ).values(),
  ];

  const lifecycleStates = input.lifecycleStates ?? ["active"];
  if (
    lifecycleStates.length < 1 ||
    lifecycleStates.some((state) => !lifecycleStateSet.has(state))
  ) {
    throw new TypeError("lifecycleStates contains an unsupported state");
  }

  const limit = input.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new RangeError("limit must be between 1 and 1000");
  }

  const parameters: unknown[] = [input.tenantId];
  const scopeClauses = scopes.map((scope) => {
    const storage = memoryScopeStorage(scope);
    parameters.push(storage.kind, storage.referenceId);
    const kindIndex = parameters.length - 1;
    const referenceIndex = parameters.length;
    return `(r.scope_kind = $${kindIndex} AND r.scope_ref_id IS NOT DISTINCT FROM $${referenceIndex})`;
  });

  parameters.push(lifecycleStates);
  const lifecycleIndex = parameters.length;
  parameters.push(limit);
  const limitIndex = parameters.length;

  const rows = await client.query<SnapshotRow>(
    `${snapshotSelect}
      WHERE r.tenant_id = $1
        AND (${scopeClauses.join(" OR ")})
        AND r.lifecycle_state = ANY($${lifecycleIndex}::text[])
      ORDER BY r.updated_at DESC, r.memory_record_id
      LIMIT $${limitIndex}`,
    parameters,
  );

  return snapshotsFromRows(client, rows.rows);
}

export function createPostgresMemoryRepository(
  client: PoolClient,
): MemoryRepository {
  return Object.freeze({
    createMemoryRecord: (input: CreateMemoryRecordInput) =>
      createMemoryRecord(client, input),
    appendMemoryRevision: (input: AppendMemoryRevisionInput) =>
      appendMemoryRevision(client, input),
    getMemoryRecordInScope: (input: GetMemoryRecordInScopeInput) =>
      getMemoryRecordInScope(client, input),
    listMemoryRecordsByScopes: (input: ListMemoryRecordsByScopesInput) =>
      listMemoryRecordsByScopes(client, input),
  });
}
