-- C10: optional per-fan chat-list preferences. No second chat session, message
-- journal or stored transcript; those remain in agents.character_sessions
-- and agents.mobile_turn_commands respectively.
CREATE TABLE masana.fan_chat_preferences (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  character_id text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT to_timestamp(0),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, fan_user_id, character_id),
  FOREIGN KEY (tenant_id, fan_user_id) REFERENCES identity.users(tenant_id, user_id),
  FOREIGN KEY (tenant_id, character_id) REFERENCES identity.characters(tenant_id, character_id),
  CHECK (updated_at >= created_at)
);
CREATE INDEX fan_chat_pins_idx ON masana.fan_chat_preferences
  (tenant_id, fan_user_id, pinned DESC, updated_at DESC);
-- The existing Masana trigger checks BOTH an active fan and an approved,
-- platform-owned character, including when an insertion races a retirement.
CREATE TRIGGER fan_chat_preferences_eligible BEFORE INSERT
  ON masana.fan_chat_preferences FOR EACH ROW
  EXECUTE FUNCTION masana.require_visible_masana();
