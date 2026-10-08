-- C02: durable, tenant-scoped person-to-person text only; depends on C01 migration 0016.
-- No AI/Twin conversation or public Talk message reuse.
CREATE TABLE talks.human_dm_conversations (
  tenant_id text NOT NULL,
  conversation_id text NOT NULL CHECK (length(conversation_id) BETWEEN 8 AND 128),
  first_user_id text NOT NULL,
  second_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, conversation_id),
  UNIQUE (tenant_id, first_user_id, second_user_id),
  CHECK (first_user_id < second_user_id),
  FOREIGN KEY (tenant_id, first_user_id) REFERENCES identity.users(tenant_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, second_user_id) REFERENCES identity.users(tenant_id, user_id) ON DELETE CASCADE
);
CREATE INDEX human_dm_conversations_second_idx ON talks.human_dm_conversations
  (tenant_id, second_user_id, updated_at DESC, conversation_id DESC);

CREATE TABLE talks.human_dm_messages (
  tenant_id text NOT NULL,
  conversation_id text NOT NULL,
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 8 AND 128),
  sender_user_id text NOT NULL,
  client_request_id text NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  -- Immutable request body hash checks idempotency collisions after an edit/delete.
  original_digest text NOT NULL CHECK (original_digest ~ '^[0-9a-f]{64}$'),
  body text NOT NULL CHECK (char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  edited_at timestamptz NULL,
  deleted_at timestamptz NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (tenant_id, message_id),
  UNIQUE (tenant_id, sender_user_id, client_request_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES talks.human_dm_conversations(tenant_id, conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, sender_user_id)
    REFERENCES identity.users(tenant_id, user_id) ON DELETE CASCADE,
  CHECK (deleted_at IS NOT NULL OR length(btrim(body)) BETWEEN 1 AND 4000),
  CHECK (deleted_at IS NULL OR body = '')
);
CREATE INDEX human_dm_messages_thread_page_idx ON talks.human_dm_messages
  (tenant_id, conversation_id, created_at DESC, message_id DESC);
CREATE INDEX human_dm_messages_sender_rate_idx ON talks.human_dm_messages
  (tenant_id, sender_user_id, created_at DESC);
-- Account deletion FKs cascade; forensic/regulated financial retention remains separate.
