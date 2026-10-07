CREATE SCHEMA IF NOT EXISTS talks;

CREATE TABLE IF NOT EXISTS talks.talks (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  host_user_id text NOT NULL,
  host_name text NOT NULL CHECK (length(btrim(host_name)) BETWEEN 1 AND 160),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  topic text NOT NULL CHECK (length(btrim(topic)) BETWEEN 1 AND 240),
  summary text NOT NULL DEFAULT '',
  state text NOT NULL CHECK (state IN ('draft','live','reconnecting','ended')),
  listener_count integer NOT NULL DEFAULT 0 CHECK (listener_count >= 0),
  duration_seconds integer NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, talk_id),
  CHECK (state <> 'live' OR (host_user_id <> '' AND started_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS talks_feed_live_idx
  ON talks.talks (tenant_id, started_at DESC)
  WHERE state = 'live';

CREATE INDEX IF NOT EXISTS talks_feed_explore_idx
  ON talks.talks (tenant_id, created_at DESC)
  WHERE state IN ('live','reconnecting','ended');

CREATE TABLE IF NOT EXISTS talks.comments (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  comment_id text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL CHECK (length(btrim(author_name)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, comment_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS talks_comments_talk_idx
  ON talks.comments (tenant_id, talk_id, created_at ASC);
