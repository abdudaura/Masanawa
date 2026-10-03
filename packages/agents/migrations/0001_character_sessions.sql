CREATE SCHEMA IF NOT EXISTS agents;

-- Identity and Skill referential admission goes through their owning read ports.
-- No transcript, prompt, grant, provider thread or foreign domain state is stored here.
CREATE TABLE agents.character_sessions (
  tenant_id text NOT NULL,
  character_session_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  character_version_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  bindings jsonb NOT NULL CHECK (jsonb_typeof(bindings) = 'object'),
  admission_hash text NOT NULL CHECK (admission_hash ~ '^sha256:[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'closed')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0 AND revision < 9007199254740991),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  closed_at timestamptz,
  close_reason text CHECK (close_reason IN ('ended', 'reset')),
  successor_session_id text,
  PRIMARY KEY (tenant_id, character_session_id),
  UNIQUE (tenant_id, user_id, character_id, relationship_id, character_session_id),
  UNIQUE (tenant_id, successor_session_id),
  CHECK (expires_at > created_at AND updated_at >= created_at),
  CHECK (successor_session_id IS NULL OR successor_session_id <> character_session_id),
  CHECK ((state = 'active' AND closed_at IS NULL AND close_reason IS NULL AND successor_session_id IS NULL)
    OR (state = 'closed' AND closed_at = updated_at AND closed_at IS NOT NULL AND close_reason IS NOT NULL
        AND ((close_reason = 'ended' AND successor_session_id IS NULL)
          OR (close_reason = 'reset' AND successor_session_id IS NOT NULL)))),
  FOREIGN KEY (tenant_id, user_id, character_id, relationship_id, successor_session_id)
    REFERENCES agents.character_sessions(tenant_id, user_id, character_id, relationship_id, character_session_id)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX character_sessions_relationship_idx
  ON agents.character_sessions(tenant_id, relationship_id, user_id, character_id, created_at);

CREATE FUNCTION agents.guard_character_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Session continuity cannot be destructively deleted' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.tenant_id, NEW.character_session_id, NEW.user_id, NEW.character_id,
         NEW.relationship_id, NEW.character_version_id, NEW.schema_version, NEW.admission_hash,
         NEW.created_at, NEW.expires_at)
     IS DISTINCT FROM
     ROW(OLD.tenant_id, OLD.character_session_id, OLD.user_id, OLD.character_id,
         OLD.relationship_id, OLD.character_version_id, OLD.schema_version, OLD.admission_hash,
         OLD.created_at, OLD.expires_at)
     OR OLD.state = 'closed' OR NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Session identity/lifetime is immutable and updates require an active revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER character_sessions_guard BEFORE UPDATE OR DELETE ON agents.character_sessions
  FOR EACH ROW EXECUTE FUNCTION agents.guard_character_session();
