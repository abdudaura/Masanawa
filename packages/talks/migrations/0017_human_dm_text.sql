-- C02 human-to-human text only. Depends on the distinct C01 0016 contact migration.
-- Existing AI conversations and public Talk messages never use these tables.
CREATE TABLE talks.human_dm_threads (
  tenant_id text NOT NULL,
  conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_user_id text NOT NULL,
  second_user_id text NOT NULL,
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  last_activity_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, conversation_id),
  UNIQUE (tenant_id, first_user_id, second_user_id),
  CHECK (first_user_id < second_user_id),
  FOREIGN KEY (tenant_id, first_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, second_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX human_dm_first_inbox_idx
  ON talks.human_dm_threads(tenant_id,first_user_id,last_activity_at DESC,conversation_id);
CREATE INDEX human_dm_second_inbox_idx
  ON talks.human_dm_threads(tenant_id,second_user_id,last_activity_at DESC,conversation_id);

CREATE TABLE talks.human_dm_messages (
  tenant_id text NOT NULL,
  conversation_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_user_id text NOT NULL,
  client_message_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4096 AND body = btrim(body)),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  edited_at timestamptz,
  deleted_at timestamptz,
  PRIMARY KEY (tenant_id,conversation_id,sequence),
  UNIQUE (tenant_id,message_id),
  UNIQUE (tenant_id,sender_user_id,client_message_id),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES talks.human_dm_threads(tenant_id,conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,sender_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  CHECK (edited_at IS NULL OR edited_at >= created_at),
  CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);
CREATE INDEX human_dm_sender_rate_idx
  ON talks.human_dm_messages(tenant_id,sender_user_id,created_at DESC);
CREATE TABLE talks.human_dm_read_cursors (
  tenant_id text NOT NULL,
  conversation_id uuid NOT NULL,
  user_id text NOT NULL,
  last_read_sequence bigint NOT NULL DEFAULT 0 CHECK (last_read_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,conversation_id,user_id),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES talks.human_dm_threads(tenant_id,conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
-- No public stage feed, analytics body projection, or read grants to other tenants.
