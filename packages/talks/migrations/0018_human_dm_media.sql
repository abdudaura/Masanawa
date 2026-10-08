-- C04 follows C01 0016 contacts + C02 0017 durable human DMs. PRIVATE S3 objects.
-- Never expose object keys/CDN URLs in public profile, discovery or message projections.
ALTER TABLE talks.human_dm_messages
 ADD COLUMN message_kind text NOT NULL DEFAULT 'text'
 CHECK (message_kind IN ('text','voice'));
ALTER TABLE talks.human_dm_messages DROP CONSTRAINT human_dm_messages_check;
ALTER TABLE talks.human_dm_messages
 ADD CONSTRAINT human_dm_messages_active_content_check CHECK (
  (deleted_at IS NOT NULL AND body IS NULL)
  OR (deleted_at IS NULL AND (
    (message_kind='text' AND length(btrim(body)) BETWEEN 1 AND 4000)
    OR (message_kind='voice' AND body IS NULL)
  ))
 );

CREATE TABLE talks.human_dm_voice_objects (
 tenant_id text NOT NULL,
 conversation_id uuid NOT NULL,
 uploader_user_id text NOT NULL,
 client_request_id text NOT NULL CHECK (length(client_request_id) BETWEEN 12 AND 128),
 object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 20 AND 300),
 sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 84 AND 1572864),
 duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 250 AND 90000),
 state text NOT NULL DEFAULT 'staged'
   CHECK (state IN ('staged','attached','orphaned','deleting')),
 message_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
 PRIMARY KEY (tenant_id,conversation_id,uploader_user_id,client_request_id),
 FOREIGN KEY (tenant_id,conversation_id)
   REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id,uploader_user_id)
   REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id,message_id)
   REFERENCES talks.human_dm_messages(tenant_id,message_id) ON DELETE SET NULL,
 CHECK ((state='attached' AND message_id IS NOT NULL)
      OR (state<>'attached'))
);
CREATE UNIQUE INDEX human_dm_voice_attached_id_idx
 ON talks.human_dm_voice_objects(tenant_id,message_id) WHERE message_id IS NOT NULL;
CREATE INDEX human_dm_voice_gc_idx
 ON talks.human_dm_voice_objects(state,updated_at) WHERE state<>'attached';
CREATE INDEX human_dm_voice_history_idx
 ON talks.human_dm_voice_objects(tenant_id,conversation_id,created_at DESC)
 WHERE state='attached';

-- Prevent edits of voice-message content and accidental replay as plain text.
CREATE OR REPLACE FUNCTION talks.guard_human_dm_voice_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.message_kind='voice' AND NEW.message_kind IS DISTINCT FROM OLD.message_kind
   THEN RAISE EXCEPTION 'Voice message kind is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.message_kind='voice' AND NEW.body IS NOT NULL
   THEN RAISE EXCEPTION 'Voice message has no text body' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER human_dm_voice_body_guard BEFORE UPDATE ON talks.human_dm_messages
 FOR EACH ROW EXECUTE FUNCTION talks.guard_human_dm_voice_body();
