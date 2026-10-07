CREATE TABLE IF NOT EXISTS talks.replay_media_jobs (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  recording_id text NOT NULL,
  egress_id text NOT NULL,
  object_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('recording','stopped','ready','aborted')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  checksum_sha256 text NULL CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (tenant_id,talk_id,recording_id),
  UNIQUE (tenant_id,egress_id),
  UNIQUE (object_key)
);

CREATE INDEX IF NOT EXISTS talks_replay_media_ready_idx
  ON talks.replay_media_jobs (tenant_id,talk_id,status);
