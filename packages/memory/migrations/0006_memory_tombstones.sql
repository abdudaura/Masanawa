CREATE TABLE memory.record_tombstones (
  tenant_id text NOT NULL,
  operation_id text NOT NULL,
  memory_record_id text NOT NULL,
  memory_revision_id text NOT NULL,
  authority_context_id text NOT NULL,
  approval_id text NOT NULL,
  policy_revision text NOT NULL
    CHECK (length(btrim(policy_revision)) BETWEEN 1 AND 256),
  principal_key text NOT NULL
    CHECK (length(btrim(principal_key)) BETWEEN 1 AND 2048),
  prior_lifecycle_revision bigint NOT NULL
    CHECK (prior_lifecycle_revision > 0),
  tombstoned_lifecycle_revision bigint NOT NULL
    CHECK (
      tombstoned_lifecycle_revision = prior_lifecycle_revision + 1
    ),
  reason text NOT NULL
    CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  tombstoned_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation_id),
  UNIQUE (tenant_id, memory_record_id),
  FOREIGN KEY (tenant_id, memory_record_id)
    REFERENCES memory.records(tenant_id, memory_record_id),
  FOREIGN KEY (
    tenant_id,
    memory_revision_id,
    memory_record_id
  )
    REFERENCES memory.revisions(
      tenant_id,
      memory_revision_id,
      memory_record_id
    )
);

CREATE INDEX memory_record_tombstones_record_idx
  ON memory.record_tombstones (tenant_id, memory_record_id);

CREATE OR REPLACE FUNCTION memory.validate_record_tombstone_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_revision_id text;
  current_lifecycle_revision bigint;
  current_lifecycle_state text;
BEGIN
  SELECT v.memory_revision_id,
         r.lifecycle_revision,
         r.lifecycle_state
    INTO current_revision_id,
         current_lifecycle_revision,
         current_lifecycle_state
    FROM memory.records r
    JOIN memory.revisions v
      ON v.tenant_id = r.tenant_id
     AND v.memory_record_id = r.memory_record_id
     AND v.revision_number = r.revision
   WHERE r.tenant_id = NEW.tenant_id
     AND r.memory_record_id = NEW.memory_record_id
   FOR UPDATE OF r;

  IF current_revision_id IS NULL THEN
    RAISE EXCEPTION 'MemoryRecord tombstone target is missing'
      USING ERRCODE = '23503';
  END IF;

  IF current_lifecycle_state = 'tombstoned' THEN
    RAISE EXCEPTION 'MemoryRecord is already tombstoned'
      USING ERRCODE = '23514';
  END IF;

  IF current_revision_id IS DISTINCT FROM NEW.memory_revision_id
     OR current_lifecycle_revision IS DISTINCT FROM
        NEW.prior_lifecycle_revision THEN
    RAISE EXCEPTION
      'MemoryRecord tombstone audit does not match current canonical state'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_record_tombstones_validate_insert
BEFORE INSERT ON memory.record_tombstones
FOR EACH ROW
EXECUTE FUNCTION memory.validate_record_tombstone_insert();

CREATE OR REPLACE FUNCTION memory.validate_tombstone_lifecycle_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lifecycle_state = 'tombstoned'
     AND OLD.lifecycle_state <> 'tombstoned' THEN
    IF NEW.lifecycle_revision <> OLD.lifecycle_revision + 1 THEN
      RAISE EXCEPTION
        'MemoryRecord tombstone must increment lifecycle revision exactly once'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM memory.record_tombstones tombstone
       WHERE tombstone.tenant_id = OLD.tenant_id
         AND tombstone.memory_record_id = OLD.memory_record_id
         AND tombstone.prior_lifecycle_revision = OLD.lifecycle_revision
         AND tombstone.tombstoned_lifecycle_revision =
             NEW.lifecycle_revision
         AND tombstone.tombstoned_at = NEW.updated_at
    ) THEN
      RAISE EXCEPTION
        'MemoryRecord tombstone transition requires matching immutable audit'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.lifecycle_state = 'tombstoned'
     AND NEW.lifecycle_state <> 'tombstoned' THEN
    RAISE EXCEPTION 'Tombstoned MemoryRecord cannot be reactivated'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_records_validate_tombstone_transition
BEFORE UPDATE ON memory.records
FOR EACH ROW
EXECUTE FUNCTION memory.validate_tombstone_lifecycle_update();

CREATE OR REPLACE FUNCTION memory.assert_record_tombstone_applied()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_state text;
  current_lifecycle_revision bigint;
  current_updated_at timestamptz;
BEGIN
  SELECT lifecycle_state,
         lifecycle_revision,
         updated_at
    INTO current_state,
         current_lifecycle_revision,
         current_updated_at
    FROM memory.records
   WHERE tenant_id = NEW.tenant_id
     AND memory_record_id = NEW.memory_record_id;

  IF current_state IS DISTINCT FROM 'tombstoned'
     OR current_lifecycle_revision IS DISTINCT FROM
        NEW.tombstoned_lifecycle_revision
     OR current_updated_at IS DISTINCT FROM NEW.tombstoned_at THEN
    RAISE EXCEPTION
      'MemoryRecord tombstone audit committed without matching lifecycle transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER memory_record_tombstones_require_transition
AFTER INSERT ON memory.record_tombstones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION memory.assert_record_tombstone_applied();

CREATE OR REPLACE FUNCTION memory.reject_record_tombstone_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'MemoryRecord tombstone audit is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER memory_record_tombstones_append_only
BEFORE UPDATE ON memory.record_tombstones
FOR EACH ROW
EXECUTE FUNCTION memory.reject_record_tombstone_update();
