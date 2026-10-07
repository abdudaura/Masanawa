CREATE TABLE IF NOT EXISTS talks.replay_sessions (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  recording_id text NOT NULL,
  host_user_id text NOT NULL,
  revision integer NOT NULL CHECK (revision>=1),
  recording_state text NOT NULL CHECK (recording_state IN ('recording','finalized','discarded')),
  publication_state text NOT NULL CHECK (publication_state IN ('not_ready','private','published','blocked')),
  publication_preference text NOT NULL CHECK (publication_preference IN ('publish','private')),
  session_json jsonb NOT NULL CHECK (jsonb_typeof(session_json)='object'),
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  finalized_at timestamptz NULL,
  published_at timestamptz NULL,
  PRIMARY KEY (tenant_id,talk_id),
  UNIQUE (tenant_id,recording_id)
);

CREATE INDEX IF NOT EXISTS talks_replay_public_idx
  ON talks.replay_sessions (tenant_id,publication_state,updated_at DESC);

CREATE TABLE IF NOT EXISTS talks.replay_segments (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  recording_id text NOT NULL,
  segment_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence>=1),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms>0),
  media_ref text NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id,segment_id),
  UNIQUE (tenant_id,talk_id,sequence)
);
