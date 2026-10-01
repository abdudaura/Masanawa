CREATE TABLE world.events (
  tenant_id text NOT NULL,
  world_event_id text NOT NULL,
  world_id text NOT NULL,
  character_id text,
  character_version_id text,
  event_kind text NOT NULL CHECK (length(btrim(event_kind)) BETWEEN 1 AND 128),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  provenance text NOT NULL
    CHECK (provenance IN ('authored', 'engine', 'imported', 'model')),
  visibility text NOT NULL
    CHECK (visibility IN ('public', 'shared', 'internal', 'private')),
  canon_state text NOT NULL
    CHECK (canon_state IN ('draft', 'approved', 'retired')),
  occurrence_key text,
  effective_start timestamptz NOT NULL,
  effective_end timestamptz,
  recorded_at timestamptz NOT NULL,
  approved_at timestamptz,
  retired_at timestamptz,
  PRIMARY KEY (tenant_id, world_event_id),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, character_version_id, character_id)
    REFERENCES identity.character_versions(
      tenant_id, character_version_id, character_id
    )
    ON DELETE RESTRICT,
  CHECK ((character_id IS NULL) = (character_version_id IS NULL)),
  CHECK (effective_end IS NULL OR effective_end >= effective_start),
  CHECK (
    (canon_state = 'draft' AND approved_at IS NULL AND retired_at IS NULL)
    OR
    (canon_state = 'approved' AND approved_at IS NOT NULL AND retired_at IS NULL)
    OR
    (canon_state = 'retired' AND approved_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX world_events_occurrence_key_unique
  ON world.events(tenant_id, world_id, occurrence_key)
  WHERE occurrence_key IS NOT NULL;

CREATE INDEX world_events_context_idx
  ON world.events(
    tenant_id,
    world_id,
    canon_state,
    effective_start DESC
  );

CREATE OR REPLACE FUNCTION world.protect_governed_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.canon_state IN ('approved', 'retired') THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.world_event_id IS DISTINCT FROM OLD.world_event_id
       OR NEW.world_id IS DISTINCT FROM OLD.world_id
       OR NEW.character_id IS DISTINCT FROM OLD.character_id
       OR NEW.character_version_id IS DISTINCT FROM OLD.character_version_id
       OR NEW.event_kind IS DISTINCT FROM OLD.event_kind
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.provenance IS DISTINCT FROM OLD.provenance
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
       OR NEW.effective_start IS DISTINCT FROM OLD.effective_start
       OR NEW.effective_end IS DISTINCT FROM OLD.effective_end
       OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Approved world canon content is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.canon_state = 'retired'
       AND NEW.canon_state IS DISTINCT FROM 'retired' THEN
      RAISE EXCEPTION 'Retired world canon cannot be reactivated'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.canon_state = 'approved'
       AND NEW.canon_state NOT IN ('approved', 'retired') THEN
      RAISE EXCEPTION 'Approved world canon may only remain approved or retire'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER world_events_governed_immutability
BEFORE UPDATE ON world.events
FOR EACH ROW
EXECUTE FUNCTION world.protect_governed_event();
