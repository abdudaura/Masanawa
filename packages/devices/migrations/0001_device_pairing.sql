CREATE SCHEMA IF NOT EXISTS devices;

CREATE TABLE devices.devices (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  enrollment_fingerprint text NOT NULL CHECK (
    length(btrim(enrollment_fingerprint)) > 0
    AND char_length(enrollment_fingerprint) <= 256
  ),
  registration_fingerprint text NOT NULL CHECK (
    registration_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  device_class text NOT NULL CHECK (
    length(btrim(device_class)) > 0 AND char_length(device_class) <= 64
  ),
  platform text NOT NULL CHECK (
    length(btrim(platform)) > 0 AND char_length(platform) <= 64
  ),
  platform_version text NOT NULL CHECK (
    length(btrim(platform_version)) > 0
    AND char_length(platform_version) <= 96
  ),
  model text NOT NULL CHECK (
    length(btrim(model)) > 0 AND char_length(model) <= 160
  ),
  app_version text NOT NULL CHECK (
    length(btrim(app_version)) > 0 AND char_length(app_version) <= 96
  ),
  state text NOT NULL CHECK (
    state IN ('pending-pairing', 'active', 'suspended')
  ),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  registered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  paired_at timestamptz,
  PRIMARY KEY (tenant_id, device_id),
  UNIQUE (tenant_id, enrollment_fingerprint),
  CHECK (updated_at >= registered_at),
  CHECK (
    (state = 'pending-pairing' AND paired_at IS NULL)
    OR
    (state IN ('active', 'suspended') AND paired_at IS NOT NULL)
  ),
  CHECK (
    paired_at IS NULL
    OR (paired_at >= registered_at AND paired_at <= updated_at)
  )
);

CREATE TABLE devices.pairing_challenges (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  pairing_request_id text NOT NULL CHECK (pairing_request_id ~ '^request_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (
    state IN ('pending', 'consumed', 'expired')
  ),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (
    failed_attempts BETWEEN 0 AND 5
  ),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  PRIMARY KEY (tenant_id, pairing_request_id),
  FOREIGN KEY (tenant_id, device_id)
    REFERENCES devices.devices(tenant_id, device_id),
  CHECK (expires_at > created_at),
  CHECK (
    expires_at - created_at BETWEEN interval '1 minute' AND interval '15 minutes'
  ),
  CHECK (
    (state = 'consumed'
      AND consumed_at IS NOT NULL
      AND consumed_at >= created_at
      AND consumed_at <= expires_at)
    OR
    (state <> 'consumed' AND consumed_at IS NULL)
  )
);

CREATE UNIQUE INDEX device_pairing_one_pending
  ON devices.pairing_challenges (tenant_id, device_id)
  WHERE state = 'pending';

CREATE INDEX device_pairing_expiry_idx
  ON devices.pairing_challenges (tenant_id, state, expires_at)
  WHERE state = 'pending';

COMMENT ON TABLE devices.devices IS
  'Canonical registered Device identity. Pairing activates the Device but does not issue an operational Device credential.';

COMMENT ON TABLE devices.pairing_challenges IS
  'One-time pairing challenges. Only SHA-256 secret hashes are persisted; raw pairing secrets must never enter durable platform state.';
