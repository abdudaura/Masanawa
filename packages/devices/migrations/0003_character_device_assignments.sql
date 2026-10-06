CREATE TABLE devices.character_device_assignments (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  character_id text NOT NULL CHECK (character_id ~ '^character_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  role text NOT NULL CHECK (role IN ('primary', 'secondary', 'pooled')),
  state text NOT NULL CHECK (state IN ('active', 'suspended', 'revoked')),
  allowed_capability_keys text[] NOT NULL CHECK (
    cardinality(allowed_capability_keys) BETWEEN 1 AND 128
  ),
  allow_degraded_capability boolean NOT NULL,
  allow_degraded_device_health boolean NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  assignment_fingerprint text NOT NULL CHECK (
    assignment_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, character_id, device_id),
  FOREIGN KEY (tenant_id, device_id)
    REFERENCES devices.devices(tenant_id, device_id),
  CHECK (valid_from >= created_at),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (updated_at >= created_at)
);

CREATE INDEX character_device_assignments_character_idx
  ON devices.character_device_assignments (
    tenant_id, character_id, state, role, device_id
  );

CREATE INDEX character_device_assignments_device_idx
  ON devices.character_device_assignments (
    tenant_id, device_id, state, character_id
  );

COMMENT ON TABLE devices.character_device_assignments IS
  'Canonical Character-to-Device assignment policy. Character identity remains in Identity; this table stores only exact references, immutable policy/validity and revisioned lifecycle state.';
