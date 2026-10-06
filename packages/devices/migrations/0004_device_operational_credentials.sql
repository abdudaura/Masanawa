CREATE TABLE devices.operational_credentials (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  device_credential_id text NOT NULL CHECK (
    device_credential_id ~ '^device-credential_'
  ),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  generation bigint NOT NULL CHECK (generation > 0),
  state text NOT NULL CHECK (state IN ('active', 'revoked')),
  verification_key_ref text NOT NULL CHECK (
    length(btrim(verification_key_ref)) BETWEEN 8 AND 512
  ),
  key_fingerprint text NOT NULL CHECK (
    length(btrim(key_fingerprint)) BETWEEN 16 AND 512
  ),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  credential_fingerprint text NOT NULL CHECK (
    credential_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  PRIMARY KEY (tenant_id, device_credential_id),
  UNIQUE (tenant_id, device_id, generation),
  FOREIGN KEY (tenant_id, device_id)
    REFERENCES devices.devices(tenant_id, device_id),
  CHECK (expires_at > issued_at),
  CHECK (
    (state = 'active' AND revoked_at IS NULL)
    OR
    (state = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= issued_at)
  )
);

CREATE UNIQUE INDEX device_one_active_operational_credential
  ON devices.operational_credentials (tenant_id, device_id)
  WHERE state = 'active';

CREATE TABLE devices.reconnect_challenges (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  request_id text NOT NULL CHECK (request_id ~ '^request_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  device_credential_id text NOT NULL CHECK (
    device_credential_id ~ '^device-credential_'
  ),
  credential_generation bigint NOT NULL CHECK (credential_generation > 0),
  challenge_digest text NOT NULL CHECK (
    length(btrim(challenge_digest)) BETWEEN 16 AND 512
  ),
  state text NOT NULL CHECK (state IN ('pending', 'consumed', 'expired')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  challenge_fingerprint text NOT NULL CHECK (
    challenge_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  PRIMARY KEY (tenant_id, request_id),
  FOREIGN KEY (tenant_id, device_credential_id)
    REFERENCES devices.operational_credentials(tenant_id, device_credential_id),
  CHECK (expires_at > created_at),
  CHECK (
    (state = 'consumed' AND consumed_at IS NOT NULL
      AND consumed_at >= created_at AND consumed_at < expires_at)
    OR
    (state <> 'consumed' AND consumed_at IS NULL)
  )
);

CREATE INDEX device_reconnect_challenge_lookup
  ON devices.reconnect_challenges (
    tenant_id, device_id, device_credential_id, state, expires_at
  );

COMMENT ON TABLE devices.operational_credentials IS
  'Operational Device credential verification metadata only. Device private signing keys never enter platform persistence.';

COMMENT ON TABLE devices.reconnect_challenges IS
  'One-time reconnect challenge custody bound to the exact current Device credential generation. Reconnect proof material is never persisted.';
