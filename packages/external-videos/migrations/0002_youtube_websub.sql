-- YouTube J14: additive source registry, verified WebSub leases and cursor tracking.
-- Do not change 0001 or any previously applied migration. Everything defaults OFF.
CREATE SCHEMA IF NOT EXISTS external_videos;

CREATE TABLE external_videos.sources (
  tenant_id text NOT NULL,
  source_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube', 'tiktok', 'facebook')),
  provider_channel_id text NOT NULL,
  channel_name text NOT NULL CHECK (char_length(trim(channel_name)) BETWEEN 1 AND 100),
  target_region text NOT NULL DEFAULT 'NG' CHECK (target_region ~ '^[A-Z]{2}$'),
  sync_mode text NOT NULL DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'authorized_api')),
  authorization_ref text,
  permission_expires_at timestamptz,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, source_id),
  UNIQUE (tenant_id, provider, provider_channel_id),
  UNIQUE (tenant_id, source_id, provider_channel_id),
  CHECK (sync_mode <> 'authorized_api' OR
    (authorization_ref IS NOT NULL AND permission_expires_at IS NOT NULL))
);

-- Only provider-approved, server-created credentials can receive official hub callbacks.
CREATE TABLE external_videos.youtube_subscriptions (
  tenant_id text NOT NULL,
  source_id text NOT NULL,
  channel_id text NOT NULL CHECK (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  callback_token_sha256 text NOT NULL
    CHECK (callback_token_sha256 ~ '^[0-9a-f]{64}$'),
  signature_secret_ref text NOT NULL CHECK (char_length(signature_secret_ref) BETWEEN 3 AND 512),
  authorized_api boolean NOT NULL DEFAULT false,
  permission_expires_at timestamptz,
  enabled boolean NOT NULL DEFAULT false,
  lease_requested_at timestamptz,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, source_id),
  UNIQUE (callback_token_sha256),
  FOREIGN KEY (tenant_id, source_id, channel_id)
    REFERENCES external_videos.sources(tenant_id, source_id, provider_channel_id)
    ON DELETE RESTRICT,
  CHECK (NOT authorized_api OR permission_expires_at IS NOT NULL),
  CHECK (lease_expires_at IS NULL OR lease_requested_at IS NULL)
);
CREATE INDEX youtube_subscriptions_renewal
  ON external_videos.youtube_subscriptions(lease_expires_at,tenant_id,source_id)
  WHERE enabled AND authorized_api;

CREATE TABLE external_videos.sync_cursors (
  tenant_id text NOT NULL,
  source_id text NOT NULL,
  next_page_token text CHECK (next_page_token IS NULL OR char_length(next_page_token) BETWEEN 1 AND 180),
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, source_id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES external_videos.sources(tenant_id,source_id)
    ON DELETE RESTRICT
);

-- Protect against changing a human-curated video based on another source's sync.
CREATE TABLE external_videos.item_sources (
  tenant_id text NOT NULL,
  item_id uuid NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,item_id,source_id),
  FOREIGN KEY (tenant_id,item_id) REFERENCES external_videos.items(tenant_id,item_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,source_id) REFERENCES external_videos.sources(tenant_id,source_id)
    ON DELETE RESTRICT
);
CREATE INDEX item_sources_by_source ON external_videos.item_sources(tenant_id,source_id,item_id);
-- No video bytes, public automation credentials or live publication are stored.
