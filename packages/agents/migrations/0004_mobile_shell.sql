CREATE SCHEMA IF NOT EXISTS agents;

CREATE TABLE IF NOT EXISTS agents.mobile_turn_commands (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  character_session_id text NOT NULL,
  request_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','media','media-set')),
  user_text text NOT NULL,
  payload_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','completed','failed')),
  agent_run_id text,
  reply text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, request_id),
  CHECK (char_length(user_text) <= 32000),
  CHECK (char_length(payload_hash) = 64),
  CHECK (reply IS NULL OR char_length(reply) <= 64000)
);

CREATE INDEX IF NOT EXISTS mobile_turn_history_idx
  ON agents.mobile_turn_commands
  (tenant_id, user_id, relationship_id, created_at DESC, request_id DESC);

CREATE TABLE IF NOT EXISTS agents.mobile_shell_events (
  event_cursor bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  character_session_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (char_length(event_type) BETWEEN 1 AND 128)
);

CREATE INDEX IF NOT EXISTS mobile_shell_events_scope_idx
  ON agents.mobile_shell_events
  (tenant_id, user_id, relationship_id, event_cursor);

CREATE TABLE IF NOT EXISTS agents.mobile_shell_actions (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  character_session_id text NOT NULL,
  document_id text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0),
  token_hash text NOT NULL,
  action_id text NOT NULL,
  node_id text NOT NULL,
  values_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','accepted','failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id, relationship_id, document_id, revision),
  CHECK (char_length(document_id) BETWEEN 1 AND 128),
  CHECK (char_length(action_id) BETWEEN 1 AND 128),
  CHECK (char_length(node_id) BETWEEN 1 AND 128),
  CHECK (char_length(token_hash) = 64),
  CHECK (char_length(values_hash) = 64)
);

CREATE TABLE IF NOT EXISTS agents.mobile_push_registrations (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  installation_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android','ios')),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id, installation_id),
  UNIQUE (tenant_id, token),
  CHECK (char_length(installation_id) BETWEEN 16 AND 128),
  CHECK (char_length(token) BETWEEN 16 AND 4096)
);

CREATE INDEX IF NOT EXISTS mobile_push_user_idx
  ON agents.mobile_push_registrations(tenant_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS agents.mobile_presence (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('available','listening','working','on_call','offline')),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id, character_id)
);

CREATE INDEX IF NOT EXISTS mobile_presence_expiry_idx
  ON agents.mobile_presence(tenant_id, user_id, expires_at);
