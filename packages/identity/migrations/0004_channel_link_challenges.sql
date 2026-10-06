CREATE TABLE identity.channel_link_challenges (
  request_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  channel_account_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  user_id text NOT NULL,
  secret_hash text NOT NULL
    CHECK (secret_hash ~ '^sha256:[0-9a-f]{64}$'),
  state text NOT NULL
    CHECK (state IN ('pending', 'verified', 'locked', 'expired')),
  attempts integer NOT NULL CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  verified_external_subject_id text
    CHECK (
      verified_external_subject_id IS NULL OR
      length(btrim(verified_external_subject_id)) BETWEEN 1 AND 512
    ),
  FOREIGN KEY (tenant_id, channel_account_id, channel)
    REFERENCES identity.channel_accounts(
      tenant_id, channel_account_id, channel
    ),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  CHECK (expires_at > created_at),
  CHECK (attempts <= max_attempts),
  CHECK (
    (verified_at IS NULL AND verified_external_subject_id IS NULL)
    OR
    (verified_at IS NOT NULL AND verified_external_subject_id IS NOT NULL)
  ),
  CHECK (
    state <> 'verified' OR (
      verified_at IS NOT NULL AND
      verified_external_subject_id IS NOT NULL AND
      attempts >= 1 AND
      verified_at >= created_at AND
      verified_at <= expires_at
    )
  ),
  CHECK (
    state = 'verified' OR (
      verified_at IS NULL AND
      verified_external_subject_id IS NULL
    )
  ),
  CHECK (state <> 'locked' OR attempts = max_attempts),
  CHECK (state <> 'pending' OR attempts < max_attempts)
);

CREATE INDEX channel_link_challenges_scope_idx
  ON identity.channel_link_challenges(
    tenant_id, channel_account_id, user_id, state
  );

CREATE INDEX channel_link_challenges_expiry_idx
  ON identity.channel_link_challenges(expires_at)
  WHERE state = 'pending';
