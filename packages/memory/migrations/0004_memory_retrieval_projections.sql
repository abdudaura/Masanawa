CREATE TABLE memory.projection_generations (
  tenant_id text NOT NULL,
  memory_projection_generation_id text NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('lexical', 'vector', 'entity', 'temporal')),
  implementation_key text NOT NULL
    CHECK (length(btrim(implementation_key)) BETWEEN 1 AND 200),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  vector_provider_key text,
  vector_model_key text,
  vector_dimension integer,
  state text NOT NULL DEFAULT 'building'
    CHECK (state IN ('building', 'current', 'retired')),
  created_at timestamptz NOT NULL,
  activated_at timestamptz,
  retired_at timestamptz,
  PRIMARY KEY (tenant_id, memory_projection_generation_id),
  CHECK (
    (
      kind = 'vector'
      AND vector_provider_key IS NOT NULL
      AND length(btrim(vector_provider_key)) BETWEEN 1 AND 200
      AND vector_model_key IS NOT NULL
      AND length(btrim(vector_model_key)) BETWEEN 1 AND 300
      AND vector_dimension IS NOT NULL
      AND vector_dimension BETWEEN 1 AND 1000000
    )
    OR
    (
      kind <> 'vector'
      AND vector_provider_key IS NULL
      AND vector_model_key IS NULL
      AND vector_dimension IS NULL
    )
  ),
  CHECK (
    (state = 'building' AND activated_at IS NULL AND retired_at IS NULL)
    OR
    (state = 'current' AND activated_at IS NOT NULL AND retired_at IS NULL)
    OR
    (
      state = 'retired'
      AND activated_at IS NOT NULL
      AND retired_at IS NOT NULL
      AND retired_at >= activated_at
    )
  )
);

CREATE UNIQUE INDEX memory_projection_one_current_idx
  ON memory.projection_generations (tenant_id, kind)
  WHERE state = 'current';

CREATE INDEX memory_projection_generation_lookup_idx
  ON memory.projection_generations (tenant_id, kind, state, created_at DESC);

CREATE TABLE memory.lexical_projections (
  tenant_id text NOT NULL,
  memory_projection_generation_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_revision_id text NOT NULL,
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
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  document_text text NOT NULL
    CHECK (length(btrim(document_text)) BETWEEN 1 AND 100000),
  search_document tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', document_text)) STORED,
  built_at timestamptz NOT NULL,
  PRIMARY KEY (
    tenant_id,
    memory_projection_generation_id,
    memory_record_id
  ),
  FOREIGN KEY (tenant_id, memory_projection_generation_id)
    REFERENCES memory.projection_generations(
      tenant_id, memory_projection_generation_id
    )
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id)
    ON DELETE CASCADE,
  FOREIGN KEY (
    tenant_id, memory_revision_id, memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id, memory_revision_id, memory_record_id
    )
    ON DELETE CASCADE,
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  )
);

CREATE INDEX memory_lexical_projection_search_idx
  ON memory.lexical_projections USING GIN (search_document);

CREATE INDEX memory_lexical_projection_scope_idx
  ON memory.lexical_projections (
    tenant_id,
    memory_projection_generation_id,
    scope_kind,
    scope_ref_id,
    memory_record_id
  );

CREATE OR REPLACE FUNCTION memory.validate_lexical_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $memory_lexical$
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
   WHERE tenant_id = NEW.tenant_id
     AND memory_projection_generation_id =
       NEW.memory_projection_generation_id
   FOR SHARE;

  IF generation_kind IS DISTINCT FROM 'lexical'
     OR generation_state IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'Lexical projection requires a building lexical generation'
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
   WHERE r.tenant_id = NEW.tenant_id
     AND r.memory_record_id = NEW.memory_record_id
   FOR SHARE OF r, v;

  IF canonical_revision_id IS NULL THEN
    RAISE EXCEPTION 'Canonical MemoryRecord revision is missing'
      USING ERRCODE = '23503';
  END IF;

  IF canonical_lifecycle IS DISTINCT FROM 'active'
     OR canonical_revision_id IS DISTINCT FROM NEW.memory_revision_id
     OR canonical_type IS DISTINCT FROM NEW.memory_type
     OR canonical_scope_kind IS DISTINCT FROM NEW.scope_kind
     OR canonical_scope_ref IS DISTINCT FROM NEW.scope_ref_id THEN
    RAISE EXCEPTION 'Lexical projection does not match current canonical memory'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$memory_lexical$;

CREATE TRIGGER memory_lexical_projection_validate
BEFORE INSERT ON memory.lexical_projections
FOR EACH ROW
EXECUTE FUNCTION memory.validate_lexical_projection();

CREATE OR REPLACE FUNCTION memory.protect_lexical_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $memory_lexical_guard$
BEGIN
  RAISE EXCEPTION 'Lexical projection rows are immutable; rebuild the generation'
    USING ERRCODE = '23514';
END;
$memory_lexical_guard$;

CREATE TRIGGER memory_lexical_projection_immutable
BEFORE UPDATE ON memory.lexical_projections
FOR EACH ROW
EXECUTE FUNCTION memory.protect_lexical_projection();

CREATE OR REPLACE FUNCTION memory.protect_projection_generation()
RETURNS trigger
LANGUAGE plpgsql
AS $memory_generation_guard$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.memory_projection_generation_id IS DISTINCT FROM
        OLD.memory_projection_generation_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.implementation_key IS DISTINCT FROM OLD.implementation_key
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
     OR NEW.vector_provider_key IS DISTINCT FROM OLD.vector_provider_key
     OR NEW.vector_model_key IS DISTINCT FROM OLD.vector_model_key
     OR NEW.vector_dimension IS DISTINCT FROM OLD.vector_dimension
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Projection generation compatibility identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'retired' THEN
    RAISE EXCEPTION 'Retired projection generation is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (OLD.state = 'building' AND NEW.state IN ('building', 'current'))
    OR
    (OLD.state = 'current' AND NEW.state IN ('current', 'retired'))
  ) THEN
    RAISE EXCEPTION 'Invalid projection generation state transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$memory_generation_guard$;

CREATE TRIGGER memory_projection_generation_guard
BEFORE UPDATE ON memory.projection_generations
FOR EACH ROW
EXECUTE FUNCTION memory.protect_projection_generation();
