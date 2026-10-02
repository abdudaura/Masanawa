CREATE TABLE memory.extraction_jobs (
  tenant_id text NOT NULL,
  memory_extraction_id text NOT NULL,
  idempotency_key text NOT NULL
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 256),
  request_fingerprint text NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  scope_kind text NOT NULL
    CHECK (scope_kind IN (
      'organization',
      'relationship',
      'character-private',
      'character-shared',
      'world',
      'session',
      'task'
    )),
  scope_ref_id text,
  source_kind text NOT NULL
    CHECK (source_kind IN (
      'platform-event',
      'world-evidence',
      'message',
      'artifact',
      'operator',
      'import',
      'other'
    )),
  source_reference text NOT NULL
    CHECK (length(btrim(source_reference)) BETWEEN 1 AND 2048),
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  extractor_key text NOT NULL
    CHECK (length(btrim(extractor_key)) BETWEEN 1 AND 128),
  extractor_version text NOT NULL
    CHECK (length(btrim(extractor_version)) BETWEEN 1 AND 128),
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN (
      'queued',
      'processing',
      'retry-scheduled',
      'completed',
      'no-facts',
      'dead-letter'
    )),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 20),
  fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  available_at timestamptz NOT NULL,
  safe_error_code text
    CHECK (
      safe_error_code IS NULL
      OR length(btrim(safe_error_code)) BETWEEN 1 AND 200
    ),
  terminal_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, memory_extraction_id),
  UNIQUE (tenant_id, idempotency_key),
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  ),
  CHECK (
    (
      state = 'processing'
      AND lease_owner IS NOT NULL
      AND lease_expires_at IS NOT NULL
    )
    OR
    (
      state <> 'processing'
      AND lease_owner IS NULL
      AND lease_expires_at IS NULL
    )
  ),
  CHECK (
    (
      state IN ('completed', 'no-facts', 'dead-letter')
      AND terminal_at IS NOT NULL
    )
    OR
    (
      state NOT IN ('completed', 'no-facts', 'dead-letter')
      AND terminal_at IS NULL
    )
  )
);

CREATE INDEX memory_extraction_claim_idx
  ON memory.extraction_jobs (
    tenant_id,
    state,
    available_at,
    lease_expires_at,
    created_at,
    memory_extraction_id
  )
  WHERE state IN ('queued', 'retry-scheduled', 'processing');

CREATE TABLE memory.extraction_attempts (
  tenant_id text NOT NULL,
  memory_extraction_id text NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  fence bigint NOT NULL CHECK (fence > 0),
  worker_id text NOT NULL
    CHECK (length(btrim(worker_id)) BETWEEN 1 AND 200),
  claimed_at timestamptz NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  outcome text
    CHECK (
      outcome IS NULL
      OR outcome IN (
        'completed',
        'no-facts',
        'retry-scheduled',
        'dead-letter',
        'lease-expired'
      )
    ),
  safe_error_code text
    CHECK (
      safe_error_code IS NULL
      OR length(btrim(safe_error_code)) BETWEEN 1 AND 200
    ),
  settled_at timestamptz,
  PRIMARY KEY (tenant_id, memory_extraction_id, attempt),
  FOREIGN KEY (tenant_id, memory_extraction_id)
    REFERENCES memory.extraction_jobs(tenant_id, memory_extraction_id)
    ON DELETE CASCADE,
  UNIQUE (tenant_id, memory_extraction_id, fence),
  CHECK (
    (outcome IS NULL AND settled_at IS NULL)
    OR
    (outcome IS NOT NULL AND settled_at IS NOT NULL)
  )
);

CREATE INDEX memory_extraction_attempt_history_idx
  ON memory.extraction_attempts (
    tenant_id,
    memory_extraction_id,
    attempt DESC
  );

CREATE OR REPLACE FUNCTION memory.protect_settled_extraction_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.outcome IS NOT NULL THEN
    RAISE EXCEPTION 'Settled memory extraction attempt is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.memory_extraction_id IS DISTINCT FROM OLD.memory_extraction_id
     OR NEW.attempt IS DISTINCT FROM OLD.attempt
     OR NEW.fence IS DISTINCT FROM OLD.fence
     OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
    RAISE EXCEPTION 'Memory extraction attempt identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_extraction_attempt_guard
BEFORE UPDATE ON memory.extraction_attempts
FOR EACH ROW
EXECUTE FUNCTION memory.protect_settled_extraction_attempt();
