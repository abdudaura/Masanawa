CREATE SCHEMA IF NOT EXISTS world;

CREATE TABLE world.worlds (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'stopped')),
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object'),
  policy_revision bigint NOT NULL DEFAULT 1 CHECK (policy_revision > 0),
  current_generation_id text NOT NULL,
  current_generation_number bigint NOT NULL DEFAULT 0
    CHECK (current_generation_number >= 0),
  simulation_time timestamptz NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, world_id),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(tenant_id)
    ON DELETE RESTRICT
);

CREATE TABLE world.generations (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  world_generation_id text NOT NULL,
  generation_number bigint NOT NULL CHECK (generation_number >= 0),
  previous_generation_id text,
  simulation_time timestamptz NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, world_generation_id),
  UNIQUE (tenant_id, world_id, generation_number),
  UNIQUE (tenant_id, world_id, world_generation_id),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, previous_generation_id)
    REFERENCES world.generations(tenant_id, world_generation_id)
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE world.worlds
  ADD CONSTRAINT worlds_current_generation_fk
  FOREIGN KEY (tenant_id, world_id, current_generation_id)
  REFERENCES world.generations(tenant_id, world_id, world_generation_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE world.simulation_inputs (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  idempotency_key text NOT NULL
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 256),
  kind text NOT NULL CHECK (length(btrim(kind)) BETWEEN 1 AND 128),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  state text NOT NULL DEFAULT 'admitted'
    CHECK (state IN ('admitted', 'completed', 'rejected')),
  received_at timestamptz NOT NULL,
  effective_at timestamptz NOT NULL,
  completed_generation_number bigint,
  PRIMARY KEY (tenant_id, world_id, sequence),
  UNIQUE (tenant_id, world_id, idempotency_key),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  CHECK (
    (state = 'admitted' AND completed_generation_number IS NULL)
    OR
    (state IN ('completed', 'rejected'))
  )
);

CREATE INDEX simulation_inputs_pending_idx
  ON world.simulation_inputs(tenant_id, world_id, sequence)
  WHERE state = 'admitted';

CREATE TABLE world.character_life_state (
  tenant_id text NOT NULL,
  world_id text NOT NULL,
  character_id text NOT NULL,
  availability text,
  narrative_state text,
  active_goal text,
  story_arc text,
  coarse_location text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  effective_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, world_id, character_id),
  FOREIGN KEY (tenant_id, world_id)
    REFERENCES world.worlds(tenant_id, world_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id)
    ON DELETE RESTRICT
);
