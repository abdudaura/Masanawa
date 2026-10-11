-- Informational call history only. No tokens, audio, transcripts or financial evidence.
CREATE TABLE agents.masana_call_history (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  call_id uuid NOT NULL,
  character_id text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  connected_at timestamptz(3),
  ended_at timestamptz(3),
  expires_at timestamptz(3) NOT NULL,
  PRIMARY KEY (tenant_id, user_id, call_id),
  CHECK (expires_at > created_at),
  CHECK (connected_at IS NULL OR connected_at >= created_at),
  CHECK (ended_at IS NULL OR ended_at >= COALESCE(connected_at, created_at))
);
CREATE INDEX masana_call_history_recent_idx
  ON agents.masana_call_history (tenant_id, user_id, created_at DESC, call_id DESC);
