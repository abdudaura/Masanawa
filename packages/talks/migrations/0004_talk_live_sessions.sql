CREATE TABLE IF NOT EXISTS talks.live_runtime (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  host_user_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('live','reconnecting','ended')),
  reconnect_grace_ends_at timestamptz NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, talk_id)
);

CREATE TABLE IF NOT EXISTS talks.live_sessions (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  session_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('host','listener')),
  connection_state text NOT NULL CHECK (connection_state IN ('connected','disconnected')),
  connected_at timestamptz NOT NULL,
  disconnected_at timestamptz NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, session_id)
);

CREATE INDEX IF NOT EXISTS talks_live_sessions_talk_idx
  ON talks.live_sessions (tenant_id, talk_id, connection_state, role);

CREATE UNIQUE INDEX IF NOT EXISTS talks_live_single_host_connected_idx
  ON talks.live_sessions (tenant_id, talk_id)
  WHERE role = 'host' AND connection_state = 'connected';
