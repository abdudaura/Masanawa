CREATE TABLE world.routines (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  routine_key text NOT NULL
    CHECK (length(btrim(routine_key)) BETWEEN 1 AND 128),
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  timezone text NOT NULL CHECK (length(btrim(timezone)) BETWEEN 1 AND 128),
  local_time time NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  input_kind text NOT NULL CHECK (length(btrim(input_kind)) BETWEEN 1 AND 128),
  input_payload jsonb NOT NULL CHECK (jsonb_typeof(input_payload) = 'object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, world_id, routine_key),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, character_version_id, character_id)
    REFERENCES identity.character_versions(
      tenant_id, character_version_id, character_id
    )
    ON DELETE RESTRICT
);

CREATE INDEX world_routines_due_lookup_idx
  ON world.routines(tenant_id, world_id, enabled, local_time)
  WHERE enabled = true;

CREATE TABLE world.story_arcs (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  story_arc_key text NOT NULL
    CHECK (length(btrim(story_arc_key)) BETWEEN 1 AND 128),
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  state text NOT NULL
    CHECK (state IN ('planned', 'active', 'completed', 'retired')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  summary text NOT NULL CHECK (length(summary) <= 10000),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, world_id, story_arc_key),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, character_version_id, character_id)
    REFERENCES identity.character_versions(
      tenant_id, character_version_id, character_id
    )
    ON DELETE RESTRICT
);

CREATE INDEX world_story_arcs_character_idx
  ON world.story_arcs(tenant_id, world_id, character_id, state);
