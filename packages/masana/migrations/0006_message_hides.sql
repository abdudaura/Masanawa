-- C13 fan-private chat hiding. Immutable turn journal remains the only message authority.
-- Forward-only; no deletion of original commands, sessions, receipts, or moderation evidence.
CREATE TABLE IF NOT EXISTS masana.fan_hidden_turns (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  character_id text NOT NULL,
  request_id text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, fan_user_id, character_id, request_id),
  FOREIGN KEY (tenant_id, fan_user_id)
    REFERENCES identity.users(tenant_id, user_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  CHECK (char_length(tenant_id) BETWEEN 1 AND 128),
  CHECK (char_length(fan_user_id) BETWEEN 1 AND 128),
  CHECK (character_id ~ '^character_[0-9a-f-]{36}$'),
  CHECK (request_id ~ '^request_[0-9a-f-]{36}$')
);
-- Admission INSERT ... SELECT must prove ownership in agents.mobile_turn_commands;
-- rows alone confer no access or authority to historical messages.
