CREATE TABLE memory.reflections (
  tenant_id text NOT NULL,
  reflection_fingerprint text NOT NULL
    CHECK (reflection_fingerprint ~ '^[0-9a-f]{64}$'),
  reflection_memory_record_id text NOT NULL,
  reflection_memory_revision_id text NOT NULL,
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
  purpose_key text NOT NULL
    CHECK (length(btrim(purpose_key)) BETWEEN 1 AND 200),
  reflector_key text NOT NULL
    CHECK (length(btrim(reflector_key)) BETWEEN 1 AND 128),
  reflector_version text NOT NULL
    CHECK (length(btrim(reflector_version)) BETWEEN 1 AND 128),
  source_count integer NOT NULL CHECK (source_count BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, reflection_fingerprint),
  UNIQUE (tenant_id, reflection_memory_record_id),
  FOREIGN KEY (tenant_id, reflection_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (
    tenant_id,
    reflection_memory_revision_id,
    reflection_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    ),
  CHECK (
    (scope_kind = 'organization' AND scope_ref_id IS NULL)
    OR
    (scope_kind <> 'organization' AND scope_ref_id IS NOT NULL)
  )
);

CREATE TABLE memory.reflection_sources (
  tenant_id text NOT NULL,
  reflection_fingerprint text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0 AND ordinal < 64),
  source_memory_record_id text NOT NULL,
  source_memory_revision_id text NOT NULL,
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (tenant_id, reflection_fingerprint, ordinal),
  UNIQUE (
    tenant_id,
    reflection_fingerprint,
    source_memory_record_id
  ),
  FOREIGN KEY (tenant_id, reflection_fingerprint)
    REFERENCES memory.reflections(tenant_id, reflection_fingerprint),
  FOREIGN KEY (tenant_id, source_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (
    tenant_id,
    source_memory_revision_id,
    source_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    )
);

CREATE INDEX memory_reflections_scope_idx
  ON memory.reflections (
    tenant_id,
    scope_kind,
    scope_ref_id,
    created_at,
    reflection_fingerprint
  );

CREATE INDEX memory_reflection_sources_source_idx
  ON memory.reflection_sources (
    tenant_id,
    source_memory_record_id,
    source_memory_revision_id
  );

CREATE OR REPLACE FUNCTION memory.validate_reflection_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_type text;
  target_scope_kind text;
  target_scope_ref text;
  target_revision_id text;
  target_lifecycle text;
BEGIN
  SELECT r.memory_type,
         r.scope_kind,
         r.scope_ref_id,
         v.memory_revision_id,
         r.lifecycle_state
    INTO target_type,
         target_scope_kind,
         target_scope_ref,
         target_revision_id,
         target_lifecycle
    FROM memory.records r
    JOIN memory.revisions v
      ON v.tenant_id = r.tenant_id
     AND v.memory_record_id = r.memory_record_id
     AND v.revision_number = r.revision
   WHERE r.tenant_id = NEW.tenant_id
     AND r.memory_record_id = NEW.reflection_memory_record_id;

  IF target_revision_id IS NULL THEN
    RAISE EXCEPTION 'Reflection target MemoryRecord is missing'
      USING ERRCODE = '23503';
  END IF;

  IF target_type <> 'reflection'
     OR target_lifecycle <> 'active'
     OR target_revision_id IS DISTINCT FROM
        NEW.reflection_memory_revision_id
     OR target_scope_kind IS DISTINCT FROM NEW.scope_kind
     OR target_scope_ref IS DISTINCT FROM NEW.scope_ref_id THEN
    RAISE EXCEPTION
      'Reflection target must be the current active reflection revision in the exact audit scope'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_reflections_validate_insert
BEFORE INSERT ON memory.reflections
FOR EACH ROW
EXECUTE FUNCTION memory.validate_reflection_insert();

CREATE OR REPLACE FUNCTION memory.validate_reflection_source_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reflection_scope_kind text;
  reflection_scope_ref text;
  reflection_record_id text;
  expected_source_count integer;
  source_scope_kind text;
  source_scope_ref text;
  current_source_revision_id text;
  source_lifecycle text;
BEGIN
  SELECT scope_kind,
         scope_ref_id,
         reflection_memory_record_id,
         source_count
    INTO reflection_scope_kind,
         reflection_scope_ref,
         reflection_record_id,
         expected_source_count
    FROM memory.reflections
   WHERE tenant_id = NEW.tenant_id
     AND reflection_fingerprint = NEW.reflection_fingerprint;

  IF reflection_record_id IS NULL THEN
    RAISE EXCEPTION 'Reflection audit header is missing'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.ordinal >= expected_source_count THEN
    RAISE EXCEPTION 'Reflection source ordinal exceeds declared source count'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.source_memory_record_id = reflection_record_id THEN
    RAISE EXCEPTION 'Reflection target cannot also be a source'
      USING ERRCODE = '23514';
  END IF;

  SELECT r.scope_kind,
         r.scope_ref_id,
         v.memory_revision_id,
         r.lifecycle_state
    INTO source_scope_kind,
         source_scope_ref,
         current_source_revision_id,
         source_lifecycle
    FROM memory.records r
    JOIN memory.revisions v
      ON v.tenant_id = r.tenant_id
     AND v.memory_record_id = r.memory_record_id
     AND v.revision_number = r.revision
   WHERE r.tenant_id = NEW.tenant_id
     AND r.memory_record_id = NEW.source_memory_record_id;

  IF current_source_revision_id IS NULL THEN
    RAISE EXCEPTION 'Reflection source MemoryRecord is missing'
      USING ERRCODE = '23503';
  END IF;

  IF source_lifecycle <> 'active'
     OR current_source_revision_id IS DISTINCT FROM
        NEW.source_memory_revision_id
     OR source_scope_kind IS DISTINCT FROM reflection_scope_kind
     OR source_scope_ref IS DISTINCT FROM reflection_scope_ref THEN
    RAISE EXCEPTION
      'Reflection source must be a current active revision in the exact reflection scope'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_reflection_sources_validate_insert
BEFORE INSERT ON memory.reflection_sources
FOR EACH ROW
EXECUTE FUNCTION memory.validate_reflection_source_insert();

CREATE OR REPLACE FUNCTION memory.assert_reflection_source_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actual_count integer;
BEGIN
  SELECT count(*)::integer
    INTO actual_count
    FROM memory.reflection_sources
   WHERE tenant_id = NEW.tenant_id
     AND reflection_fingerprint = NEW.reflection_fingerprint;

  IF actual_count <> NEW.source_count THEN
    RAISE EXCEPTION
      'Reflection source set does not match declared source count'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER memory_reflections_require_sources
AFTER INSERT ON memory.reflections
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION memory.assert_reflection_source_count();

CREATE OR REPLACE FUNCTION memory.reject_reflection_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Memory reflection audit is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_reflections_immutable
BEFORE UPDATE OR DELETE ON memory.reflections
FOR EACH ROW
EXECUTE FUNCTION memory.reject_reflection_mutation();

CREATE TRIGGER memory_reflection_sources_immutable
BEFORE UPDATE OR DELETE ON memory.reflection_sources
FOR EACH ROW
EXECUTE FUNCTION memory.reject_reflection_mutation();
