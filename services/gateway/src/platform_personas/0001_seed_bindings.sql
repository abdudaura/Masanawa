-- F03 / R03: additive, tenant-fenced durable seed ID reservation.
-- DO NOT run directly against production or register concurrently with F11.
-- Apply through the canonical migration sequencer only after schema/lock review.
CREATE TABLE IF NOT EXISTS agents.platform_persona_seed_bindings (
  tenant_id text NOT NULL,
  seed_key text NOT NULL CHECK (seed_key LIKE 'platform.%' AND substring(seed_key from 10) ~ '^[a-z]+),
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seed_key),
  UNIQUE (tenant_id, character_id),
  UNIQUE (tenant_id, character_version_id),
  CHECK (length(tenant_id) BETWEEN 1 AND 128),
  CHECK (length(character_id) BETWEEN 1 AND 128),
  CHECK (length(character_version_id) BETWEEN 1 AND 128)
);
COMMENT ON TABLE agents.platform_persona_seed_bindings IS
  'F03 immutable seed-key to canonical identity reservation. NOT proof of provision, readiness or qualified voice.';
 AND length(seed_key) <= 80),
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seed_key),
  UNIQUE (tenant_id, character_id),
  UNIQUE (tenant_id, character_version_id),
  CHECK (length(tenant_id) BETWEEN 1 AND 128),
  CHECK (length(character_id) BETWEEN 1 AND 128),
  CHECK (length(character_version_id) BETWEEN 1 AND 128)
);
COMMENT ON TABLE agents.platform_persona_seed_bindings IS
  'F03 immutable seed-key to canonical identity reservation. NOT proof of provision, readiness or qualified voice.';
