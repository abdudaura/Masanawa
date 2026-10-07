CREATE TABLE commerce.crypto_chat_actions (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  request_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('convert','withdraw')),
  provider_code text NOT NULL,
  target_provider_code text,
  amount text NOT NULL,
  destination_address text,
  quote_summary text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','executing','completed')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,character_id),
  UNIQUE (tenant_id,request_id),
  CHECK (expires_at > created_at)
);
CREATE INDEX crypto_chat_actions_expiry_idx
  ON commerce.crypto_chat_actions(expires_at,state);
