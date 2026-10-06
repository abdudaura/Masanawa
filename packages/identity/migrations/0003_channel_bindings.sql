CREATE TABLE identity.channel_accounts (
  tenant_id text NOT NULL,
  channel_account_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  provider_account_ref text NOT NULL
    CHECK (length(btrim(provider_account_ref)) BETWEEN 1 AND 256),
  state text NOT NULL CHECK (state IN ('active', 'disabled', 'revoked')),
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, channel_account_id),
  UNIQUE (tenant_id, channel, provider_account_ref),
  UNIQUE (tenant_id, channel_account_id, channel),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(tenant_id),
  CHECK (updated_at >= created_at)
);

CREATE TABLE identity.channel_bindings (
  tenant_id text NOT NULL,
  channel_account_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  user_id text NOT NULL,
  external_subject_id text NOT NULL
    CHECK (length(btrim(external_subject_id)) BETWEEN 1 AND 512),
  state text NOT NULL CHECK (state IN ('pending-proof', 'active', 'revoked')),
  proof_method text
    CHECK (
      proof_method IS NULL OR
      proof_method IN (
        'channel-possession-challenge',
        'authenticated-cross-channel-confirmation'
      )
    ),
  proof_evidence_ref text
    CHECK (
      proof_evidence_ref IS NULL OR
      length(btrim(proof_evidence_ref)) BETWEEN 8 AND 512
    ),
  proof_verified_at timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, channel_account_id, external_subject_id),
  FOREIGN KEY (tenant_id, channel_account_id, channel)
    REFERENCES identity.channel_accounts(
      tenant_id, channel_account_id, channel
    ),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (
      proof_method IS NULL AND
      proof_evidence_ref IS NULL AND
      proof_verified_at IS NULL
    ) OR (
      proof_method IS NOT NULL AND
      proof_evidence_ref IS NOT NULL AND
      proof_verified_at IS NOT NULL
    )
  ),
  CHECK (
    state <> 'active' OR
    (
      proof_method IS NOT NULL AND
      proof_evidence_ref IS NOT NULL AND
      proof_verified_at IS NOT NULL
    )
  ),
  CHECK (
    state <> 'pending-proof' OR
    (
      proof_method IS NULL AND
      proof_evidence_ref IS NULL AND
      proof_verified_at IS NULL
    )
  )
);

CREATE UNIQUE INDEX channel_bindings_one_active_user_per_account
  ON identity.channel_bindings(tenant_id, channel_account_id, user_id)
  WHERE state = 'active';

CREATE INDEX channel_bindings_user_lookup
  ON identity.channel_bindings(tenant_id, channel_account_id, user_id);

CREATE INDEX channel_bindings_subject_lookup
  ON identity.channel_bindings(
    tenant_id, channel_account_id, external_subject_id
  );
