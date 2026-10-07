ALTER TABLE commerce.owner_access_messages
  ADD COLUMN expires_at timestamptz;

UPDATE commerce.owner_access_messages
   SET expires_at = sent_at + interval '30 days'
 WHERE expires_at IS NULL;

ALTER TABLE commerce.owner_access_messages
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE commerce.owner_access_messages
  ADD CONSTRAINT owner_access_message_expiry_check
  CHECK (expires_at > sent_at);

DROP TRIGGER IF EXISTS owner_access_message_immutable
  ON commerce.owner_access_messages;

CREATE TRIGGER owner_access_message_update_immutable
BEFORE UPDATE ON commerce.owner_access_messages
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();

CREATE INDEX owner_access_messages_expiry_idx
  ON commerce.owner_access_messages(tenant_id,expires_at);
