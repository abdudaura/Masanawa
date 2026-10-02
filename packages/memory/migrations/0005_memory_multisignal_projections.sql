CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory.vector_projections (
  tenant_id text NOT NULL,
  memory_projection_generation_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_revision_id text NOT NULL,
  memory_type text NOT NULL,
  scope_kind text NOT NULL,
  scope_ref_id text,
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  embedding vector NOT NULL,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (
    tenant_id,
    memory_projection_generation_id,
    memory_record_id
  ),
  FOREIGN KEY (tenant_id, memory_projection_generation_id)
    REFERENCES memory.projection_generations(
      tenant_id,
      memory_projection_generation_id
    )
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_revision_id, memory_record_id)
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    )
    ON DELETE CASCADE,
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  ),
  CHECK (vector_norm(embedding) > 0)
);

CREATE INDEX memory_vector_projections_scope_idx
  ON memory.vector_projections (
    tenant_id,
    memory_projection_generation_id,
    scope_kind,
    scope_ref_id,
    memory_record_id
  );

CREATE TABLE memory.entity_projections (
  tenant_id text NOT NULL,
  memory_projection_generation_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_revision_id text NOT NULL,
  memory_type text NOT NULL,
  scope_kind text NOT NULL,
  scope_ref_id text,
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  entity_keys text[] NOT NULL DEFAULT '{}',
  built_at timestamptz NOT NULL,
  PRIMARY KEY (
    tenant_id,
    memory_projection_generation_id,
    memory_record_id
  ),
  FOREIGN KEY (tenant_id, memory_projection_generation_id)
    REFERENCES memory.projection_generations(
      tenant_id,
      memory_projection_generation_id
    )
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_revision_id, memory_record_id)
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    )
    ON DELETE CASCADE,
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  ),
  CHECK (cardinality(entity_keys) <= 256)
);

CREATE INDEX memory_entity_projections_scope_idx
  ON memory.entity_projections (
    tenant_id,
    memory_projection_generation_id,
    scope_kind,
    scope_ref_id,
    memory_record_id
  );

CREATE INDEX memory_entity_projections_keys_idx
  ON memory.entity_projections
  USING gin (entity_keys);

CREATE TABLE memory.temporal_projections (
  tenant_id text NOT NULL,
  memory_projection_generation_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_revision_id text NOT NULL,
  memory_type text NOT NULL,
  scope_kind text NOT NULL,
  scope_ref_id text,
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  event_time timestamptz,
  observed_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  expires_at timestamptz,
  temporal_anchor timestamptz GENERATED ALWAYS AS (
    COALESCE(event_time, observed_at)
  ) STORED,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (
    tenant_id,
    memory_projection_generation_id,
    memory_record_id
  ),
  FOREIGN KEY (tenant_id, memory_projection_generation_id)
    REFERENCES memory.projection_generations(
      tenant_id,
      memory_projection_generation_id
    )
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_revision_id, memory_record_id)
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    )
    ON DELETE CASCADE,
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  ),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
  CHECK (expires_at IS NULL OR expires_at > observed_at)
);

CREATE INDEX memory_temporal_projections_scope_anchor_idx
  ON memory.temporal_projections (
    tenant_id,
    memory_projection_generation_id,
    scope_kind,
    scope_ref_id,
    temporal_anchor
  );

CREATE OR REPLACE FUNCTION memory.assert_projection_source(
  p_tenant_id text,
  p_memory_projection_generation_id text,
  p_expected_kind text,
  p_memory_record_id text,
  p_memory_revision_id text,
  p_memory_type text,
  p_scope_kind text,
  p_scope_ref_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  generation_kind text;
  generation_state text;
  canonical_type text;
  canonical_scope_kind text;
  canonical_scope_ref text;
  canonical_revision_id text;
  canonical_lifecycle text;
BEGIN
  SELECT kind, state
    INTO generation_kind, generation_state
    FROM memory.projection_generations
   WHERE tenant_id = p_tenant_id
     AND memory_projection_generation_id =
       p_memory_projection_generation_id;

  IF generation_kind IS NULL THEN
    RAISE EXCEPTION 'Projection generation was not found'
      USING ERRCODE = '23503';
  END IF;

  IF generation_kind <> p_expected_kind OR generation_state <> 'building' THEN
    RAISE EXCEPTION
      'Projection rows may only be inserted into a matching building generation'
      USING ERRCODE = '23514';
  END IF;

  SELECT r.memory_type,
         r.scope_kind,
         r.scope_ref_id,
         r.lifecycle_state,
         v.memory_revision_id
    INTO canonical_type,
         canonical_scope_kind,
         canonical_scope_ref,
         canonical_lifecycle,
         canonical_revision_id
    FROM memory.records r
    JOIN memory.revisions v
      ON v.tenant_id = r.tenant_id
     AND v.memory_record_id = r.memory_record_id
     AND v.revision_number = r.revision
   WHERE r.tenant_id = p_tenant_id
     AND r.memory_record_id = p_memory_record_id;

  IF canonical_revision_id IS NULL
     OR canonical_lifecycle <> 'active'
     OR canonical_revision_id IS DISTINCT FROM p_memory_revision_id
     OR canonical_type IS DISTINCT FROM p_memory_type
     OR canonical_scope_kind IS DISTINCT FROM p_scope_kind
     OR canonical_scope_ref IS DISTINCT FROM p_scope_ref_id THEN
    RAISE EXCEPTION
      'Projection source must match the current active canonical memory revision'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION memory.validate_vector_projection_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_dimension integer;
BEGIN
  PERFORM memory.assert_projection_source(
    NEW.tenant_id,
    NEW.memory_projection_generation_id,
    'vector',
    NEW.memory_record_id,
    NEW.memory_revision_id,
    NEW.memory_type,
    NEW.scope_kind,
    NEW.scope_ref_id
  );

  SELECT vector_dimension
    INTO expected_dimension
    FROM memory.projection_generations
   WHERE tenant_id = NEW.tenant_id
     AND memory_projection_generation_id =
       NEW.memory_projection_generation_id;

  IF expected_dimension IS NULL
     OR vector_dims(NEW.embedding) <> expected_dimension THEN
    RAISE EXCEPTION
      'Vector projection dimension does not match generation compatibility'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER vector_projections_validate_insert
BEFORE INSERT ON memory.vector_projections
FOR EACH ROW
EXECUTE FUNCTION memory.validate_vector_projection_insert();

CREATE OR REPLACE FUNCTION memory.validate_entity_projection_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_keys text[];
BEGIN
  PERFORM memory.assert_projection_source(
    NEW.tenant_id,
    NEW.memory_projection_generation_id,
    'entity',
    NEW.memory_record_id,
    NEW.memory_revision_id,
    NEW.memory_type,
    NEW.scope_kind,
    NEW.scope_ref_id
  );

  SELECT COALESCE(
           array_agg(DISTINCT lower(btrim(value)) ORDER BY lower(btrim(value))),
           '{}'::text[]
         )
    INTO normalized_keys
    FROM unnest(NEW.entity_keys) value
   WHERE length(btrim(value)) BETWEEN 1 AND 300;

  IF cardinality(normalized_keys) <> cardinality(NEW.entity_keys)
     OR normalized_keys IS DISTINCT FROM NEW.entity_keys THEN
    RAISE EXCEPTION
      'Entity projection keys must be normalized, unique and sorted'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER entity_projections_validate_insert
BEFORE INSERT ON memory.entity_projections
FOR EACH ROW
EXECUTE FUNCTION memory.validate_entity_projection_insert();

CREATE OR REPLACE FUNCTION memory.validate_temporal_projection_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_event_time timestamptz;
  canonical_observed_at timestamptz;
  canonical_valid_from timestamptz;
  canonical_valid_to timestamptz;
  canonical_expires_at timestamptz;
BEGIN
  PERFORM memory.assert_projection_source(
    NEW.tenant_id,
    NEW.memory_projection_generation_id,
    'temporal',
    NEW.memory_record_id,
    NEW.memory_revision_id,
    NEW.memory_type,
    NEW.scope_kind,
    NEW.scope_ref_id
  );

  SELECT v.event_time,
         v.observed_at,
         v.valid_from,
         v.valid_to,
         v.expires_at
    INTO canonical_event_time,
         canonical_observed_at,
         canonical_valid_from,
         canonical_valid_to,
         canonical_expires_at
    FROM memory.records r
    JOIN memory.revisions v
      ON v.tenant_id = r.tenant_id
     AND v.memory_record_id = r.memory_record_id
     AND v.revision_number = r.revision
   WHERE r.tenant_id = NEW.tenant_id
     AND r.memory_record_id = NEW.memory_record_id;

  IF canonical_event_time IS DISTINCT FROM NEW.event_time
     OR canonical_observed_at IS DISTINCT FROM NEW.observed_at
     OR canonical_valid_from IS DISTINCT FROM NEW.valid_from
     OR canonical_valid_to IS DISTINCT FROM NEW.valid_to
     OR canonical_expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION
      'Temporal projection must preserve canonical revision time metadata'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER temporal_projections_validate_insert
BEFORE INSERT ON memory.temporal_projections
FOR EACH ROW
EXECUTE FUNCTION memory.validate_temporal_projection_insert();

CREATE OR REPLACE FUNCTION memory.reject_signal_projection_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Memory signal projection rows are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER vector_projections_immutable
BEFORE UPDATE ON memory.vector_projections
FOR EACH ROW
EXECUTE FUNCTION memory.reject_signal_projection_update();

CREATE TRIGGER entity_projections_immutable
BEFORE UPDATE ON memory.entity_projections
FOR EACH ROW
EXECUTE FUNCTION memory.reject_signal_projection_update();

CREATE TRIGGER temporal_projections_immutable
BEFORE UPDATE ON memory.temporal_projections
FOR EACH ROW
EXECUTE FUNCTION memory.reject_signal_projection_update();
