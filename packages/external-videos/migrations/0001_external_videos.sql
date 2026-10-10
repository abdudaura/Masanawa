-- Forward-only L-VIDEO schema. AF00 must register migration root in central registry.
CREATE SCHEMA IF NOT EXISTS external_videos;
CREATE TABLE IF NOT EXISTS external_videos.sources (
  tenant_id text NOT NULL,
  source_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube','tiktok','facebook')),
  provider_channel_id text NOT NULL,
  channel_name text NOT NULL CHECK (length(trim(channel_name)) BETWEEN 1 AND 140),
  sync_mode text NOT NULL CHECK (sync_mode IN ('manual','authorized_api')),
  authorization_ref text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, source_id),
  UNIQUE (tenant_id, provider, provider_channel_id),
  CHECK (sync_mode = 'manual' OR authorization_ref IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS external_videos.items (
  tenant_id text NOT NULL,
  item_id uuid NOT NULL,
  source_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube','tiktok','facebook')),
  provider_video_id text NOT NULL,
  canonical_url text NOT NULL CHECK (canonical_url LIKE 'https://%'),
  embed_url text NOT NULL CHECK (embed_url LIKE 'https://%'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','unavailable')),
  verified_embeddable boolean NOT NULL DEFAULT false,
  region_allowed boolean NOT NULL DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id),
  UNIQUE (tenant_id, provider, provider_video_id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES external_videos.sources(tenant_id, source_id),
  CHECK (state <> 'approved' OR (verified_embeddable AND region_allowed AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS external_video_visible_idx ON external_videos.items(tenant_id,published_at DESC,item_id)
WHERE state='approved' AND verified_embeddable AND region_allowed;
