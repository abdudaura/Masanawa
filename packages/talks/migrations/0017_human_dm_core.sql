-- C02. Applies AFTER C01 0016_human_messaging_contacts.sql.
-- Human DMs, not agent conversations, public Talks or financial operations.
CREATE TABLE talks.human_dm_conversations (
 tenant_id text NOT NULL,
 conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
 first_user_id text NOT NULL,
 second_user_id text NOT NULL,
 last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,conversation_id),
 UNIQUE (tenant_id,first_user_id,second_user_id),
 CHECK (first_user_id < second_user_id),
 FOREIGN KEY (tenant_id,first_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id,second_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX human_dm_conversation_first_idx ON talks.human_dm_conversations(tenant_id,first_user_id,updated_at DESC);
CREATE INDEX human_dm_conversation_second_idx ON talks.human_dm_conversations(tenant_id,second_user_id,updated_at DESC);

CREATE TABLE talks.human_dm_messages (
 tenant_id text NOT NULL,
 conversation_id uuid NOT NULL,
 sequence bigint GENERATED ALWAYS AS IDENTITY,
 message_id uuid NOT NULL DEFAULT gen_random_uuid(),
 sender_user_id text NOT NULL,
 client_request_id text NOT NULL CHECK (length(client_request_id) BETWEEN 12 AND 128),
 original_sha256 char(64) NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
 body text NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 edited_at timestamptz NULL,
 deleted_at timestamptz NULL,
 PRIMARY KEY (tenant_id,conversation_id,sequence),
 UNIQUE (tenant_id,message_id),
 UNIQUE (tenant_id,conversation_id,sender_user_id,client_request_id),
 FOREIGN KEY (tenant_id,conversation_id) REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id,sender_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
 CHECK ((deleted_at IS NULL AND body IS NOT NULL AND length(btrim(body)) BETWEEN 1 AND 4000)
     OR (deleted_at IS NOT NULL AND body IS NULL))
);
CREATE INDEX human_dm_messages_sender_rate_idx ON talks.human_dm_messages(tenant_id,sender_user_id,created_at DESC);
CREATE TABLE talks.human_dm_reads (
 tenant_id text NOT NULL,
 conversation_id uuid NOT NULL,
 user_id text NOT NULL,
 last_read_sequence bigint NOT NULL DEFAULT 0 CHECK (last_read_sequence >= 0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,conversation_id,user_id),
 FOREIGN KEY (tenant_id,conversation_id) REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
-- PRIVACY: API grants are enforced on every request and within send transactions.
-- Do not grant client/direct database access to these tables.
