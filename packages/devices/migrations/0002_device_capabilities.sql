CREATE TABLE devices.capability_publications (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  generation bigint NOT NULL CHECK (generation > 0),
  publication_fingerprint text NOT NULL CHECK (
    publication_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  published_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, device_id, generation),
  FOREIGN KEY (tenant_id, device_id)
    REFERENCES devices.devices(tenant_id, device_id)
);

CREATE TABLE devices.capability_facts (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  generation bigint NOT NULL CHECK (generation > 0),
  capability_key text NOT NULL CHECK (
    length(btrim(capability_key)) > 0
    AND char_length(capability_key) <= 160
  ),
  readiness text NOT NULL CHECK (
    readiness IN ('ready', 'degraded', 'unavailable')
  ),
  reason text,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, device_id, generation, capability_key),
  FOREIGN KEY (tenant_id, device_id, generation)
    REFERENCES devices.capability_publications(
      tenant_id, device_id, generation
    ),
  CHECK (
    (readiness = 'ready' AND reason IS NULL)
    OR
    (readiness <> 'ready'
      AND reason IS NOT NULL
      AND length(btrim(reason)) > 0
      AND char_length(reason) <= 500)
  )
);

CREATE TABLE devices.device_health (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  device_id text NOT NULL CHECK (device_id ~ '^device_'),
  state text NOT NULL CHECK (
    state IN ('healthy', 'degraded', 'unavailable')
  ),
  reason text,
  fact_fingerprint text NOT NULL CHECK (
    fact_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  observed_at timestamptz NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, device_id),
  FOREIGN KEY (tenant_id, device_id)
    REFERENCES devices.devices(tenant_id, device_id),
  CHECK (
    (state = 'healthy' AND reason IS NULL)
    OR
    (state <> 'healthy'
      AND reason IS NOT NULL
      AND length(btrim(reason)) > 0
      AND char_length(reason) <= 500)
  ),
  CHECK (updated_at >= observed_at)
);

CREATE INDEX device_capability_current_idx
  ON devices.capability_publications (
    tenant_id, device_id, generation DESC
  );

COMMENT ON TABLE devices.capability_publications IS
  'Immutable complete DeviceCapability generations. Capability absence from the current generation means the Device does not currently publish that capability.';

COMMENT ON TABLE devices.device_health IS
  'Latest monotonic Device health/last-seen fact. Staleness is evaluated by readers against observed_at; it never invents capability support.';
