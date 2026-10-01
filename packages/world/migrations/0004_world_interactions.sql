CREATE TABLE world.interactions (
  tenant_id text NOT NULL,
  world_interaction_id text NOT NULL,
  world_id text NOT NULL,
  interaction_kind text NOT NULL
    CHECK (length(btrim(interaction_kind)) BETWEEN 1 AND 128),
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
  PRIMARY KEY (tenant_id, world_interaction_id),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  CHECK (effective_end IS NULL OR effective_end >= effective_start),
  CHECK (
    (canon_state = 'draft' AND approved_at IS NULL AND retired_at IS NULL)
    OR
    (canon_state = 'approved' AND approved_at IS NOT NULL AND retired_at IS NULL)
    OR
    (canon_state = 'retired' AND approved_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX world_interactions_occurrence_key_unique
  ON world.interactions(tenant_id, world_id, occurrence_key)
  WHERE occurrence_key IS NOT NULL;

CREATE INDEX world_interactions_context_idx
  ON world.interactions(
    tenant_id,
    world_id,
    canon_state,
    effective_start DESC
  );

CREATE TABLE world.interaction_participants (
  tenant_id text NOT NULL,
  world_interaction_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  role text NOT NULL CHECK (length(btrim(role)) BETWEEN 1 AND 128),
  PRIMARY KEY (tenant_id, world_interaction_id, ordinal),
  UNIQUE (tenant_id, world_interaction_id, character_id),
  FOREIGN KEY (tenant_id, world_interaction_id)
    REFERENCES world.interactions(tenant_id, world_interaction_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, character_version_id, character_id)
    REFERENCES identity.character_versions(
      tenant_id, character_version_id, character_id
    )
    ON DELETE RESTRICT
);

CREATE INDEX world_interaction_participants_character_idx
  ON world.interaction_participants(
    tenant_id,
    character_id,
    world_interaction_id
  );

CREATE OR REPLACE FUNCTION world.protect_governed_interaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.canon_state IN ('approved', 'retired') THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.world_interaction_id IS DISTINCT FROM OLD.world_interaction_id
       OR NEW.world_id IS DISTINCT FROM OLD.world_id
       OR NEW.interaction_kind IS DISTINCT FROM OLD.interaction_kind
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.provenance IS DISTINCT FROM OLD.provenance
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.occurrence_key IS DISTINCT FROM OLD.occurrence_key
       OR NEW.effective_start IS DISTINCT FROM OLD.effective_start
       OR NEW.effective_end IS DISTINCT FROM OLD.effective_end
       OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Approved world interaction evidence is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.canon_state = 'retired'
       AND NEW.canon_state IS DISTINCT FROM 'retired' THEN
      RAISE EXCEPTION 'Retired world interaction cannot be reactivated'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.canon_state = 'approved'
       AND NEW.canon_state NOT IN ('approved', 'retired') THEN
      RAISE EXCEPTION 'Approved world interaction may only remain approved or retire'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER world_interactions_governed_immutability
BEFORE UPDATE ON world.interactions
FOR EACH ROW
EXECUTE FUNCTION world.protect_governed_interaction();

CREATE OR REPLACE FUNCTION world.protect_interaction_participant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  interaction_state text;
  target_tenant text;
  target_interaction text;
BEGIN
  target_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  target_interaction := COALESCE(
    NEW.world_interaction_id,
    OLD.world_interaction_id
  );

  SELECT canon_state
    INTO interaction_state
    FROM world.interactions
   WHERE tenant_id = target_tenant
     AND world_interaction_id = target_interaction;

  IF interaction_state IN ('approved', 'retired') THEN
    RAISE EXCEPTION 'Approved world interaction participants are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$;

CREATE TRIGGER world_interaction_participants_immutable
BEFORE INSERT OR UPDATE OR DELETE ON world.interaction_participants
FOR EACH ROW
EXECUTE FUNCTION world.protect_interaction_participant();
