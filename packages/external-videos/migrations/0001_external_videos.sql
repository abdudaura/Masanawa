-- Forward-only, additive. No old media, ledger, migrations or history is touched.
CREATE SCHEMA IF NOT EXISTS external_videos;
CREATE TABLE IF NOT EXISTS external_videos.items (
  tenant_id text NOT NULL,
  item_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube','tiktok','facebook')),
  provider_video_id text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  channel_name text NOT NULL CHECK (char_length(channel_name) BETWEEN 1 AND 100),
  review_state text NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','approved','hidden','unavailable')),
  verified_at timestamptz,
  verification_reference text,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT video_primary_key PRIMARY KEY (tenant_id, item_id),
  CONSTRAINT video_provider_id_unique UNIQUE (tenant_id, provider, provider_video_id),
  CONSTRAINT approved_video_verified CHECK (review_state <> 'approved' OR (verified_at IS NOT NULL AND verification_reference IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS video_public_page
  ON external_videos.items (tenant_id, review_state, created_at DESC, item_id DESC);
CREATE TABLE IF NOT EXISTS external_videos.review_audit (
  tenant_id text NOT NULL,
  event_id uuid NOT NULL,
  item_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('submit','approve','hide','unavailable')),
  verification_reference text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES external_videos.items(tenant_id, item_id) ON DELETE RESTRICT
);
-- Never issue write grants to guest or fan principals; server role checks are mandatory.
