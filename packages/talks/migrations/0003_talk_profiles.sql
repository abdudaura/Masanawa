CREATE TABLE IF NOT EXISTS talks.public_profiles (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  handle text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 1000),
  avatar_url text NULL,
  live_talk_id text NULL,
  twin_public_id text NULL,
  twin_display_name text NULL,
  talks_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(talks_json) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id),
  UNIQUE (tenant_id, handle)
);

CREATE TABLE IF NOT EXISTS talks.follows (
  tenant_id text NOT NULL,
  follower_user_id text NOT NULL,
  followed_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);

CREATE INDEX IF NOT EXISTS talks_follows_followed_idx
  ON talks.follows (tenant_id, followed_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS talks.persona_profiles (
  tenant_id text NOT NULL,
  public_id text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  kind text NOT NULL CHECK (kind IN ('expert','twin')),
  seat_fee_label text NOT NULL CHECK (length(seat_fee_label) <= 80),
  is_available boolean NOT NULL DEFAULT true,
  role text NOT NULL DEFAULT '' CHECK (length(role) <= 160),
  bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 1000),
  avatar_url text NULL,
  owner_handle text NULL,
  owner_display_name text NULL,
  topics_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(topics_json) = 'array'),
  appearances_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(appearances_json) = 'array'),
  is_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, public_id),
  CHECK (
    (kind = 'expert' AND owner_handle IS NULL)
    OR kind = 'twin'
  )
);
