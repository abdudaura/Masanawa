ALTER TABLE memory.records
  ADD COLUMN lifecycle_revision bigint NOT NULL DEFAULT 1
    CHECK (lifecycle_revision > 0);

CREATE TABLE memory.record_links (
  tenant_id text NOT NULL,
  source_memory_record_id text NOT NULL,
  source_memory_revision_id text NOT NULL,
  target_memory_record_id text NOT NULL,
  target_memory_revision_id text NOT NULL,
  link_kind text NOT NULL CHECK (link_kind IN ('supersedes', 'absorbs')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, source_memory_record_id),
  FOREIGN KEY (tenant_id, source_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (tenant_id, target_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (
    tenant_id, source_memory_revision_id, source_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id, memory_revision_id, memory_record_id
    ),
  FOREIGN KEY (
    tenant_id, target_memory_revision_id, target_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id, memory_revision_id, memory_record_id
    ),
  CHECK (source_memory_record_id <> target_memory_record_id)
);

CREATE INDEX memory_record_links_target_idx
  ON memory.record_links (tenant_id, target_memory_record_id);

CREATE TABLE memory.scope_publications (
  tenant_id text NOT NULL,
  operation_id text NOT NULL,
  source_memory_record_id text NOT NULL,
  source_memory_revision_id text NOT NULL,
  target_memory_record_id text NOT NULL,
  target_memory_revision_id text NOT NULL,
  authority_context_id text NOT NULL,
  approval_id text NOT NULL,
  policy_revision text NOT NULL
    CHECK (length(btrim(policy_revision)) BETWEEN 1 AND 256),
  principal_key text NOT NULL
    CHECK (length(btrim(principal_key)) BETWEEN 1 AND 2048),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  published_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation_id),
  UNIQUE (tenant_id, target_memory_record_id),
  FOREIGN KEY (tenant_id, source_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (tenant_id, target_memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (
    tenant_id, source_memory_revision_id, source_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id, memory_revision_id, memory_record_id
    ),
  FOREIGN KEY (
    tenant_id, target_memory_revision_id, target_memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id, memory_revision_id, memory_record_id
    ),
  CHECK (source_memory_record_id <> target_memory_record_id)
);

CREATE INDEX memory_scope_publications_source_idx
  ON memory.scope_publications (tenant_id, source_memory_record_id);

CREATE OR REPLACE FUNCTION memory.validate_record_link_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_kind text;
  source_ref text;
  source_type text;
  target_kind text;
  target_ref text;
  target_type text;
BEGIN
  SELECT scope_kind, scope_ref_id, memory_type
    INTO source_kind, source_ref, source_type
    FROM memory.records
   WHERE tenant_id = NEW.tenant_id
     AND memory_record_id = NEW.source_memory_record_id;

  SELECT scope_kind, scope_ref_id, memory_type
    INTO target_kind, target_ref, target_type
    FROM memory.records
   WHERE tenant_id = NEW.tenant_id
     AND memory_record_id = NEW.target_memory_record_id;

  IF source_kind IS NULL OR target_kind IS NULL THEN
    RAISE EXCEPTION 'Memory lineage record is missing'
      USING ERRCODE = '23503';
  END IF;

  IF source_kind IS DISTINCT FROM target_kind
     OR source_ref IS DISTINCT FROM target_ref THEN
    RAISE EXCEPTION 'Memory lineage cannot cross scope'
      USING ERRCODE = '23514';
  END IF;

  IF source_type IS DISTINCT FROM target_type THEN
    RAISE EXCEPTION 'Memory lineage cannot change memory type'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_record_links_same_scope
BEFORE INSERT ON memory.record_links
FOR EACH ROW
EXECUTE FUNCTION memory.validate_record_link_scope();

CREATE OR REPLACE FUNCTION memory.validate_scope_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_kind text;
  target_kind text;
BEGIN
  SELECT scope_kind INTO source_kind
    FROM memory.records
   WHERE tenant_id = NEW.tenant_id
     AND memory_record_id = NEW.source_memory_record_id;

  SELECT scope_kind INTO target_kind
    FROM memory.records
   WHERE tenant_id = NEW.tenant_id
     AND memory_record_id = NEW.target_memory_record_id;

  IF source_kind IS NULL OR target_kind IS NULL THEN
    RAISE EXCEPTION 'Memory publication record is missing'
      USING ERRCODE = '23503';
  END IF;

  IF source_kind NOT IN (
       'relationship',
       'character-private',
       'session',
       'task'
     ) THEN
    RAISE EXCEPTION 'Memory publication source must be private or bounded'
      USING ERRCODE = '23514';
  END IF;

  IF target_kind NOT IN (
       'character-shared',
       'world',
       'organization'
     ) THEN
    RAISE EXCEPTION 'Memory publication target must be shared'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_scope_publications_valid_scope
BEFORE INSERT ON memory.scope_publications
FOR EACH ROW
EXECUTE FUNCTION memory.validate_scope_publication();

CREATE OR REPLACE FUNCTION memory.reject_record_link_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Memory record lineage is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_record_links_append_only
BEFORE UPDATE ON memory.record_links
FOR EACH ROW
EXECUTE FUNCTION memory.reject_record_link_update();

CREATE OR REPLACE FUNCTION memory.reject_scope_publication_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Memory scope publication audit is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_scope_publications_append_only
BEFORE UPDATE ON memory.scope_publications
FOR EACH ROW
EXECUTE FUNCTION memory.reject_scope_publication_update();
