CREATE TABLE security.customer_channel_links (
  channel text NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  external_user_id text NOT NULL CHECK (length(external_user_id) BETWEEN 1 AND 256),
  chat_id text NOT NULL CHECK (length(chat_id) BETWEEN 1 AND 256),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  character_session_id text,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (channel,external_user_id),
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES security.platform_user_profiles(tenant_id,user_id)
);

CREATE TABLE security.customer_channel_messages (
  channel text NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 512),
  external_user_id text NOT NULL CHECK (length(external_user_id) BETWEEN 1 AND 256),
  state text NOT NULL CHECK (state IN ('processing','completed','failed')),
  reply text,
  received_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (channel,message_id)
);

CREATE INDEX customer_channel_messages_user_idx
  ON security.customer_channel_messages(channel,external_user_id,received_at DESC);
