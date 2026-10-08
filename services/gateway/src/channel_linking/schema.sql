-- U26 isolated additive schema. F11 owns migration-manifest registration.
-- Run after security/0101_customer_channels and platform profile migrations.
CREATE TABLE IF NOT EXISTS security.channel_link_intents (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  code_hash text CHECK (code_hash IS NULL OR code_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  window_started_at timestamptz NOT NULL,
  issued_count integer NOT NULL DEFAULT 1 CHECK (issued_count BETWEEN 1 AND 5),
  consumed_at timestamptz,
  verified_external_id text CHECK (verified_external_id IS NULL OR length(verified_external_id) BETWEEN 1 AND 256),
  verified_chat_id text CHECK (verified_chat_id IS NULL OR length(verified_chat_id) BETWEEN 1 AND 256),
  CHECK ((verified_external_id IS NULL) = (verified_chat_id IS NULL)),
  PRIMARY KEY (tenant_id,user_id,channel),
  UNIQUE (code_hash),
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES security.platform_user_profiles(tenant_id,user_id)
    ON DELETE CASCADE,
  CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS channel_link_intents_expires_idx
  ON security.channel_link_intents(expires_at)
  WHERE code_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS security.channel_link_preferences (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES security.platform_user_profiles(tenant_id,user_id)
    ON DELETE CASCADE
);

