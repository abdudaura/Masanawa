import {
  PlatformError,
  createCanonicalId,
  toInstant,
  type Instant,
  type MemoryExtractionId,
  type TenantId,
} from "@masanawa/contracts";
import {
  assertMemoryExtractionClaimShape,
  memoryExtractionRequestFingerprint,
  memoryScopeFromStorage,
  memoryScopeStorage,
  normalizeMemoryExtractionRequest,
  normalizeMemoryExtractionSafeErrorCode,
  staleMemoryExtractionClaim,
  type ClaimedMemoryExtraction,
  type EnqueueMemoryExtractionInput,
  type MemoryExtractionAdmission,
  type MemoryExtractionAttempt,
  type MemoryExtractionAttemptOutcome,
  type MemoryExtractionJob,
  type MemoryExtractionSettlement,
  type MemoryExtractionState,
  type MemoryEvidenceSourceKind,
  type MemoryScopeKind,
} from "@masanawa/memory";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface ExtractionJobRow {
  tenant_id: TenantId;
  memory_extraction_id: MemoryExtractionId;
  idempotency_key: string;
  request_fingerprint: string;
  scope_kind: MemoryScopeKind;
  scope_ref_id: string | null;
  source_kind: MemoryEvidenceSourceKind;
  source_reference: string;
  source_content_hash: string;
  extractor_key: string;
  extractor_version: string;
  state: MemoryExtractionState;
  attempt: number;
  max_attempts: number;
  fence: string;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  available_at: Date;
  safe_error_code: string | null;
  terminal_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ExtractionAttemptRow {
  tenant_id: TenantId;
  memory_extraction_id: MemoryExtractionId;
  attempt: number;
  fence: string;
  worker_id: string;
  claimed_at: Date;
  lease_expires_at: Date;
  outcome: MemoryExtractionAttemptOutcome | null;
  safe_error_code: string | null;
  settled_at: Date | null;
}

function safeInteger(value: number | string, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL returned invalid ${name}`);
  }
  return parsed;
}

function jobFromRow(row: ExtractionJobRow): MemoryExtractionJob {
  return Object.freeze({
    tenantId: row.tenant_id,
    memoryExtractionId: row.memory_extraction_id,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    scope: memoryScopeFromStorage(row.scope_kind, row.scope_ref_id),
    source: Object.freeze({
      kind: row.source_kind,
      reference: row.source_reference,
      contentHash: row.source_content_hash,
    }),
    extractor: Object.freeze({
      key: row.extractor_key,
      version: row.extractor_version,
    }),
    state: row.state,
    attempt: safeInteger(row.attempt, "memory extraction attempt"),
    maxAttempts: safeInteger(row.max_attempts, "memory extraction max attempts"),
    fence: safeInteger(row.fence, "memory extraction fence"),
    availableAt: toInstant(row.available_at),
    safeErrorCode: row.safe_error_code,
    terminalAt: row.terminal_at ? toInstant(row.terminal_at) : null,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function claimedFromRow(row: ExtractionJobRow): ClaimedMemoryExtraction {
  if (
    row.state !== "processing" ||
    row.lease_owner === null ||
    row.lease_expires_at === null
  ) {
    throw new Error("Claim query returned an unclaimed memory extraction job");
  }
  return Object.freeze({
    ...jobFromRow(row),
    state: "processing" as const,
    workerId: row.lease_owner,
    leaseExpiresAt: toInstant(row.lease_expires_at),
  });
}

function attemptFromRow(row: ExtractionAttemptRow): MemoryExtractionAttempt {
  return Object.freeze({
    tenantId: row.tenant_id,
    memoryExtractionId: row.memory_extraction_id,
    attempt: safeInteger(row.attempt, "memory extraction attempt"),
    fence: safeInteger(row.fence, "memory extraction attempt fence"),
    workerId: row.worker_id,
    claimedAt: toInstant(row.claimed_at),
    leaseExpiresAt: toInstant(row.lease_expires_at),
    outcome: row.outcome,
    safeErrorCode: row.safe_error_code,
    settledAt: row.settled_at ? toInstant(row.settled_at) : null,
  });
}

const jobSelect = `
  SELECT tenant_id,
         memory_extraction_id,
         idempotency_key,
         request_fingerprint,
         scope_kind,
         scope_ref_id,
         source_kind,
         source_reference,
         source_content_hash,
         extractor_key,
         extractor_version,
         state,
         attempt,
         max_attempts,
         fence::text,
         lease_owner,
         lease_expires_at,
         available_at,
         safe_error_code,
         terminal_at,
         created_at,
         updated_at
    FROM memory.extraction_jobs
`;

async function loadMemoryExtractionByIdempotency(
  client: PoolClient,
  tenantId: TenantId,
  idempotencyKey: string,
): Promise<MemoryExtractionJob | null> {
  const result = await client.query<ExtractionJobRow>(
    `${jobSelect}
      WHERE tenant_id = $1
        AND idempotency_key = $2`,
    [tenantId, idempotencyKey],
  );
  return result.rows[0] ? jobFromRow(result.rows[0]) : null;
}

export async function getMemoryExtractionJob(
  client: PoolClient,
  tenantId: TenantId,
  memoryExtractionId: MemoryExtractionId,
): Promise<MemoryExtractionJob | null> {
  const result = await client.query<ExtractionJobRow>(
    `${jobSelect}
      WHERE tenant_id = $1
        AND memory_extraction_id = $2`,
    [tenantId, memoryExtractionId],
  );
  return result.rows[0] ? jobFromRow(result.rows[0]) : null;
}

export async function listMemoryExtractionAttempts(
  client: PoolClient,
  tenantId: TenantId,
  memoryExtractionId: MemoryExtractionId,
): Promise<readonly MemoryExtractionAttempt[]> {
  const result = await client.query<ExtractionAttemptRow>(
    `SELECT tenant_id,
            memory_extraction_id,
            attempt,
            fence::text,
            worker_id,
            claimed_at,
            lease_expires_at,
            outcome,
            safe_error_code,
            settled_at
       FROM memory.extraction_attempts
      WHERE tenant_id = $1
        AND memory_extraction_id = $2
      ORDER BY attempt`,
    [tenantId, memoryExtractionId],
  );
  return Object.freeze(result.rows.map(attemptFromRow));
}

export async function enqueueMemoryExtraction(
  client: PoolClient,
  input: EnqueueMemoryExtractionInput,
): Promise<MemoryExtractionAdmission> {
  const normalized = normalizeMemoryExtractionRequest(input);
  const requestFingerprint = memoryExtractionRequestFingerprint(normalized);
  const storage = memoryScopeStorage(normalized.scope);
  const memoryExtractionId = createCanonicalId("memory-extraction");

  const inserted = await client.query<ExtractionJobRow>(
    `INSERT INTO memory.extraction_jobs (
       tenant_id,
       memory_extraction_id,
       idempotency_key,
       request_fingerprint,
       scope_kind,
       scope_ref_id,
       source_kind,
       source_reference,
       source_content_hash,
       extractor_key,
       extractor_version,
       state,
       max_attempts,
       available_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',$12,$13)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
     RETURNING tenant_id,
               memory_extraction_id,
               idempotency_key,
               request_fingerprint,
               scope_kind,
               scope_ref_id,
               source_kind,
               source_reference,
               source_content_hash,
               extractor_key,
               extractor_version,
               state,
               attempt,
               max_attempts,
               fence::text,
               lease_owner,
               lease_expires_at,
               available_at,
               safe_error_code,
               terminal_at,
               created_at,
               updated_at`,
    [
      normalized.tenantId,
      memoryExtractionId,
      normalized.idempotencyKey,
      requestFingerprint,
      storage.kind,
      storage.referenceId,
      normalized.source.kind,
      normalized.source.reference,
      normalized.source.contentHash,
      normalized.extractor.key,
      normalized.extractor.version,
      normalized.maxAttempts,
      normalized.availableAt,
    ],
  );

  const existing =
    inserted.rows[0] ??
    (await loadMemoryExtractionByIdempotency(
      client,
      normalized.tenantId,
      normalized.idempotencyKey,
    ));

  if (!existing) {
    throw new PlatformError({
      code: "memory.extraction_admission_conflict",
      category: "conflict",
      message: "Could not resolve memory extraction after idempotency conflict",
      retryable: true,
    });
  }

  const job = inserted.rows[0] ? jobFromRow(inserted.rows[0]) : existing;
  if (job.requestFingerprint !== requestFingerprint) {
    throw new PlatformError({
      code: "memory.extraction_idempotency_conflict",
      category: "conflict",
      message:
        "Memory extraction idempotency key is already bound to different scope/source/extractor inputs",
      retryable: false,
    });
  }

  return Object.freeze({
    job,
    reused: inserted.rowCount === 0,
  });
}

async function recoverExpiredMemoryExtractionClaims(
  client: PoolClient,
  tenantId: TenantId,
): Promise<void> {
  await client.query(
    `UPDATE memory.extraction_attempts AS attempt
        SET outcome = 'lease-expired',
            safe_error_code = 'memory.extraction.lease_expired',
            settled_at = clock_timestamp()
       FROM memory.extraction_jobs AS job
      WHERE job.tenant_id = $1
        AND job.state = 'processing'
        AND job.lease_expires_at <= clock_timestamp()
        AND attempt.tenant_id = job.tenant_id
        AND attempt.memory_extraction_id = job.memory_extraction_id
        AND attempt.attempt = job.attempt
        AND attempt.fence = job.fence
        AND attempt.outcome IS NULL`,
    [tenantId],
  );

  await client.query(
    `UPDATE memory.extraction_jobs
        SET state = CASE
              WHEN attempt >= max_attempts THEN 'dead-letter'
              ELSE 'retry-scheduled'
            END,
            lease_owner = NULL,
            lease_expires_at = NULL,
            available_at = CASE
              WHEN attempt >= max_attempts THEN available_at
              ELSE clock_timestamp()
            END,
            safe_error_code = 'memory.extraction.lease_expired',
            terminal_at = CASE
              WHEN attempt >= max_attempts THEN clock_timestamp()
              ELSE NULL
            END,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND state = 'processing'
        AND lease_expires_at <= clock_timestamp()`,
    [tenantId],
  );
}

export async function claimMemoryExtractionBatch(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  },
): Promise<readonly ClaimedMemoryExtraction[]> {
  assertMemoryExtractionClaimShape(input);

  return withTransaction(pool, async (client) => {
    await recoverExpiredMemoryExtractionClaims(client, input.tenantId);

    const claimed = await client.query<ExtractionJobRow>(
      `WITH candidates AS (
         SELECT tenant_id, memory_extraction_id
           FROM memory.extraction_jobs
          WHERE tenant_id = $1
            AND state IN ('queued', 'retry-scheduled')
            AND available_at <= clock_timestamp()
            AND attempt < max_attempts
          ORDER BY available_at, created_at, memory_extraction_id
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE memory.extraction_jobs AS job
          SET state = 'processing',
              attempt = job.attempt + 1,
              fence = job.fence + 1,
              lease_owner = $3,
              lease_expires_at =
                clock_timestamp() + ($4::bigint * interval '1 millisecond'),
              safe_error_code = NULL,
              terminal_at = NULL,
              updated_at = clock_timestamp()
         FROM candidates
        WHERE job.tenant_id = candidates.tenant_id
          AND job.memory_extraction_id = candidates.memory_extraction_id
       RETURNING job.tenant_id,
                 job.memory_extraction_id,
                 job.idempotency_key,
                 job.request_fingerprint,
                 job.scope_kind,
                 job.scope_ref_id,
                 job.source_kind,
                 job.source_reference,
                 job.source_content_hash,
                 job.extractor_key,
                 job.extractor_version,
                 job.state,
                 job.attempt,
                 job.max_attempts,
                 job.fence::text,
                 job.lease_owner,
                 job.lease_expires_at,
                 job.available_at,
                 job.safe_error_code,
                 job.terminal_at,
                 job.created_at,
                 job.updated_at`,
      [input.tenantId, input.limit, input.workerId.trim(), input.leaseMs],
    );

    if (claimed.rows.length === 0) {
      return Object.freeze([]);
    }

    const ids = claimed.rows.map((row) => row.memory_extraction_id);
    await client.query(
      `INSERT INTO memory.extraction_attempts (
         tenant_id,
         memory_extraction_id,
         attempt,
         fence,
         worker_id,
         claimed_at,
         lease_expires_at
       )
       SELECT tenant_id,
              memory_extraction_id,
              attempt,
              fence,
              lease_owner,
              updated_at,
              lease_expires_at
         FROM memory.extraction_jobs
        WHERE tenant_id = $1
          AND memory_extraction_id = ANY($2::text[])
          AND state = 'processing'
          AND lease_owner = $3`,
      [input.tenantId, ids, input.workerId.trim()],
    );

    return Object.freeze(claimed.rows.map(claimedFromRow));
  });
}

export async function renewMemoryExtractionClaim(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly memoryExtractionId: MemoryExtractionId;
    readonly workerId: string;
    readonly fence: number;
    readonly leaseMs: number;
  },
): Promise<ClaimedMemoryExtraction> {
  assertMemoryExtractionClaimShape({
    workerId: input.workerId,
    limit: 1,
    leaseMs: input.leaseMs,
  });
  if (!Number.isSafeInteger(input.fence) || input.fence < 1) {
    throw new RangeError("fence must be a positive safe integer");
  }

  return withTransaction(pool, async (client) => {
    const renewed = await client.query<ExtractionJobRow>(
      `UPDATE memory.extraction_jobs
          SET lease_expires_at =
                clock_timestamp() + ($5::bigint * interval '1 millisecond'),
              updated_at = clock_timestamp()
        WHERE tenant_id = $1
          AND memory_extraction_id = $2
          AND state = 'processing'
          AND lease_owner = $3
          AND fence = $4
          AND lease_expires_at > clock_timestamp()
        RETURNING tenant_id,
                  memory_extraction_id,
                  idempotency_key,
                  request_fingerprint,
                  scope_kind,
                  scope_ref_id,
                  source_kind,
                  source_reference,
                  source_content_hash,
                  extractor_key,
                  extractor_version,
                  state,
                  attempt,
                  max_attempts,
                  fence::text,
                  lease_owner,
                  lease_expires_at,
                  available_at,
                  safe_error_code,
                  terminal_at,
                  created_at,
                  updated_at`,
      [
        input.tenantId,
        input.memoryExtractionId,
        input.workerId.trim(),
        input.fence,
        input.leaseMs,
      ],
    );
    const row = renewed.rows[0];
    if (!row) throw staleMemoryExtractionClaim();

    const attemptUpdate = await client.query(
      `UPDATE memory.extraction_attempts
          SET lease_expires_at = $5
        WHERE tenant_id = $1
          AND memory_extraction_id = $2
          AND fence = $3
          AND worker_id = $4
          AND outcome IS NULL`,
      [
        input.tenantId,
        input.memoryExtractionId,
        input.fence,
        input.workerId.trim(),
        row.lease_expires_at,
      ],
    );
    if (attemptUpdate.rowCount !== 1) {
      throw new Error("Current memory extraction claim has no active attempt row");
    }

    return claimedFromRow(row);
  });
}

export async function settleMemoryExtractionClaim(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly memoryExtractionId: MemoryExtractionId;
    readonly workerId: string;
    readonly fence: number;
    readonly settlement: MemoryExtractionSettlement;
  },
): Promise<MemoryExtractionJob> {
  assertMemoryExtractionClaimShape({
    workerId: input.workerId,
    limit: 1,
    leaseMs: 1,
  });
  if (!Number.isSafeInteger(input.fence) || input.fence < 1) {
    throw new RangeError("fence must be a positive safe integer");
  }

  const safeErrorCode =
    input.settlement.outcome === "completed" ||
    input.settlement.outcome === "no-facts"
      ? null
      : normalizeMemoryExtractionSafeErrorCode(
          input.settlement.safeErrorCode,
        );
  const retryAt =
    input.settlement.outcome === "retryable-failure"
      ? toInstant(input.settlement.retryAt)
      : null;

  return withTransaction(pool, async (client) => {
    const current = await client.query<ExtractionJobRow>(
      `${jobSelect}
        WHERE tenant_id = $1
          AND memory_extraction_id = $2
        FOR UPDATE`,
      [input.tenantId, input.memoryExtractionId],
    );
    const row = current.rows[0];
    if (
      !row ||
      row.state !== "processing" ||
      row.lease_owner !== input.workerId.trim() ||
      safeInteger(row.fence, "memory extraction fence") !== input.fence ||
      row.lease_expires_at === null
    ) {
      throw staleMemoryExtractionClaim();
    }

    const attempt = safeInteger(row.attempt, "memory extraction attempt");
    const maxAttempts = safeInteger(
      row.max_attempts,
      "memory extraction max attempts",
    );

    let nextState: MemoryExtractionState;
    let attemptOutcome: MemoryExtractionAttemptOutcome;
    let terminal = false;

    switch (input.settlement.outcome) {
      case "completed":
        nextState = "completed";
        attemptOutcome = "completed";
        terminal = true;
        break;
      case "no-facts":
        nextState = "no-facts";
        attemptOutcome = "no-facts";
        terminal = true;
        break;
      case "permanent-failure":
        nextState = "dead-letter";
        attemptOutcome = "dead-letter";
        terminal = true;
        break;
      case "retryable-failure":
        if (attempt >= maxAttempts) {
          nextState = "dead-letter";
          attemptOutcome = "dead-letter";
          terminal = true;
        } else {
          nextState = "retry-scheduled";
          attemptOutcome = "retry-scheduled";
        }
        break;
    }

    const updated = await client.query<ExtractionJobRow>(
      `UPDATE memory.extraction_jobs
          SET state = $6,
              lease_owner = NULL,
              lease_expires_at = NULL,
              available_at = CASE
                WHEN $6 = 'retry-scheduled' THEN $7::timestamptz
                ELSE available_at
              END,
              safe_error_code = $8,
              terminal_at = CASE
                WHEN $9::boolean THEN clock_timestamp()
                ELSE NULL
              END,
              updated_at = clock_timestamp()
        WHERE tenant_id = $1
          AND memory_extraction_id = $2
          AND state = 'processing'
          AND lease_owner = $3
          AND fence = $4
          AND attempt = $5
          AND lease_expires_at > clock_timestamp()
        RETURNING tenant_id,
                  memory_extraction_id,
                  idempotency_key,
                  request_fingerprint,
                  scope_kind,
                  scope_ref_id,
                  source_kind,
                  source_reference,
                  source_content_hash,
                  extractor_key,
                  extractor_version,
                  state,
                  attempt,
                  max_attempts,
                  fence::text,
                  lease_owner,
                  lease_expires_at,
                  available_at,
                  safe_error_code,
                  terminal_at,
                  created_at,
                  updated_at`,
      [
        input.tenantId,
        input.memoryExtractionId,
        input.workerId.trim(),
        input.fence,
        attempt,
        nextState,
        retryAt,
        safeErrorCode,
        terminal,
      ],
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw staleMemoryExtractionClaim();

    const settledAttempt = await client.query(
      `UPDATE memory.extraction_attempts
          SET outcome = $5,
              safe_error_code = $6,
              settled_at = clock_timestamp()
        WHERE tenant_id = $1
          AND memory_extraction_id = $2
          AND attempt = $3
          AND fence = $4
          AND outcome IS NULL`,
      [
        input.tenantId,
        input.memoryExtractionId,
        attempt,
        input.fence,
        attemptOutcome,
        safeErrorCode,
      ],
    );
    if (settledAttempt.rowCount !== 1) {
      throw new Error("Current memory extraction claim has no unsettled attempt row");
    }

    return jobFromRow(updatedRow);
  });
}
