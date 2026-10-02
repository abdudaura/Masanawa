CREATE SCHEMA IF NOT EXISTS memory;

CREATE TABLE memory.records (
  tenant_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_type text NOT NULL
    CHECK (memory_type IN (
      'observation',
      'fact',
      'event',
      'state',
      'preference',
      'relationship',
      'plan',
      'reflection',
      'procedural',
      'summary',
      'prohibition'
    )),
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
  lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN (
      'active',
      'superseded',
      'absorbed',
      'expired',
      'tombstoned'
    )),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, memory_record_id),
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  ),
  CHECK (updated_at >= created_at)
);

CREATE INDEX memory_records_scope_idx
  ON memory.records (
    tenant_id,
    scope_kind,
    scope_ref_id,
    lifecycle_state,
    updated_at DESC
  );

CREATE TABLE memory.revisions (
  tenant_id text NOT NULL,
  memory_revision_id text NOT NULL,
  memory_record_id text NOT NULL,
  revision_number bigint NOT NULL CHECK (revision_number > 0),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 100000),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object'),
  confidence double precision NOT NULL DEFAULT 1
    CHECK (confidence >= 0 AND confidence <= 1),
  extraction_method text NOT NULL
    CHECK (length(btrim(extraction_method)) BETWEEN 1 AND 128),
  extraction_model_version text
    CHECK (
      extraction_model_version IS NULL
      OR length(btrim(extraction_model_version)) BETWEEN 1 AND 256
    ),
  event_time timestamptz,
  observed_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, memory_revision_id),
  UNIQUE (tenant_id, memory_record_id, revision_number),
  UNIQUE (tenant_id, memory_revision_id, memory_record_id),
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id)
    ON DELETE CASCADE,
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
  CHECK (expires_at IS NULL OR expires_at > observed_at)
);

CREATE INDEX memory_revisions_record_idx
  ON memory.revisions (tenant_id, memory_record_id, revision_number DESC);

CREATE TABLE memory.evidence (
  tenant_id text NOT NULL,
  memory_revision_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal > 0 AND ordinal <= 128),
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
  verbatim_text text
    CHECK (
      verbatim_text IS NULL
      OR length(verbatim_text) BETWEEN 1 AND 100000
    ),
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, memory_revision_id, ordinal),
  FOREIGN KEY (tenant_id, memory_revision_id)
    REFERENCES memory.revisions(tenant_id, memory_revision_id)
    ON DELETE CASCADE
);

CREATE INDEX memory_evidence_source_idx
  ON memory.evidence (tenant_id, source_kind, source_reference);

CREATE OR REPLACE FUNCTION memory.reject_record_identity_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.memory_record_id IS DISTINCT FROM OLD.memory_record_id
     OR NEW.memory_type IS DISTINCT FROM OLD.memory_type
     OR NEW.scope_kind IS DISTINCT FROM OLD.scope_kind
     OR NEW.scope_ref_id IS DISTINCT FROM OLD.scope_ref_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'MemoryRecord identity/type/scope is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_records_immutable_identity
BEFORE UPDATE ON memory.records
FOR EACH ROW
EXECUTE FUNCTION memory.reject_record_identity_update();

CREATE OR REPLACE FUNCTION memory.reject_revision_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'MemoryRevision is append-only'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_revisions_append_only
BEFORE UPDATE ON memory.revisions
FOR EACH ROW
EXECUTE FUNCTION memory.reject_revision_update();

CREATE OR REPLACE FUNCTION memory.reject_evidence_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Memory evidence is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_evidence_immutable
BEFORE UPDATE ON memory.evidence
FOR EACH ROW
EXECUTE FUNCTION memory.reject_evidence_update();
