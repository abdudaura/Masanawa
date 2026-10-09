-- F03/R03: additive tenant-scoped durable seed-key-to-canonical-ID reservation.
-- Not registered with any migration runner; F11 must approve ordering and apply.
-- Never apply this file to production without an authorized change process.
CREATE TABLE IF NOT EXISTS agents.platform_persona_seed_bindings (
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  seed_key text NOT NULL CHECK (
    seed_key LIKE 'platform.%'
    AND substring(seed_key from 10) ~ '^[a-z]+$'
    AND length(seed_key) BETWEEN 10 AND 80
  ),
  character_id text NOT NULL CHECK (length(character_id) BETWEEN 1 AND 128),
  character_version_id text NOT NULL CHECK (length(character_version_id) BETWEEN 1 AND 128),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, seed_key),
  UNIQUE (tenant_id, character_id),
  UNIQUE (tenant_id, character_version_id)
);
COMMENT ON TABLE agents.platform_persona_seed_bindings IS
  'F03 immutable identity reservation, not proof of persona availability, payment, voice or safety qualification.';
