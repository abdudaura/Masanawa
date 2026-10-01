CREATE TABLE world.events (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  world_event_id text NOT NULL,
  generation_number bigint NOT NULL CHECK (generation_number > 0),
  character_id text,
  source_character_version_id text,
  kind text NOT NULL CHECK (length(btrim(kind)) BETWEEN 1 AND 128),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  provenance text NOT NULL
    CHECK (provenance IN ('authored', 'imported', 'engine')),
  visibility text NOT NULL
    CHECK (visibility IN ('public', 'internal', 'private')),
  canon_state text NOT NULL
    CHECK (canon_state IN ('draft', 'approved', 'retired')),
  occurrence_key text,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  recorded_at timestamptz NOT NULL,
  approved_at timestamptz,
  retired_at timestamptz,
  PRIMARY KEY (tenant_id, world_event_id),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, world_id, generation_number)
    REFERENCES world.generations(tenant_id, world_id, generation_number)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id,
    source_character_version_id,
    character_id
  )
    REFERENCES identity.character_versions(
      tenant_id,
      character_version_id,
      character_id
    )
    ON DELETE RESTRICT,
  CHECK (
    (character_id IS NULL AND source_character_version_id IS NULL)
    OR
    (character_id IS NOT NULL AND source_character_version_id IS NOT NULL)
  ),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (
    (canon_state = 'draft' AND approved_at IS NULL AND retired_at IS NULL)
    OR
    (canon_state = 'approved' AND approved_at IS NOT NULL AND retired_at IS NULL)
    OR
    (canon_state = 'retired' AND approved_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX world_event_occurrence_key_idx
  ON world.events(tenant_id, world_id, occurrence_key)
  WHERE occurrence_key IS NOT NULL;

CREATE INDEX world_events_character_idx
  ON world.events(tenant_id, world_id, character_id, generation_number);

CREATE OR REPLACE FUNCTION world.reject_approved_world_event_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.canon_state = 'approved' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.world_id IS DISTINCT FROM OLD.world_id
       OR NEW.world_event_id IS DISTINCT FROM OLD.world_event_id
       OR NEW.generation_number IS DISTINCT FROM OLD.generation_number
       OR NEW.character_id IS DISTINCT FROM OLD.character_id
       OR NEW.source_character_version_id IS DISTINCT FROM OLD.source_character_version_id
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.provenance IS DISTINCT FROM OLD.provenance
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Approved WorldEvent evidence is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.canon_state NOT IN ('approved', 'retired') THEN
      RAISE EXCEPTION 'Approved WorldEvent cannot return to draft'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER world_events_approved_immutable
BEFORE UPDATE ON world.events
FOR EACH ROW
EXECUTE FUNCTION world.reject_approved_world_event_rewrite();
