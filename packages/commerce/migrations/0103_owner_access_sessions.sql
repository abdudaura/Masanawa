CREATE SCHEMA IF NOT EXISTS commerce;

CREATE TABLE commerce.owner_access_messages (
  tenant_id text NOT NULL,
  request_id text NOT NULL,
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 8 AND 160),
  sender_user_id text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  sent_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,request_id,message_id),
  FOREIGN KEY (tenant_id,request_id)
    REFERENCES commerce.owner_access_requests(tenant_id,request_id)
    ON DELETE RESTRICT
);
CREATE INDEX owner_access_messages_request_idx
  ON commerce.owner_access_messages(
    tenant_id,request_id,sent_at ASC,message_id ASC
  );

CREATE TABLE commerce.owner_access_presence (
  tenant_id text NOT NULL,
  request_id text NOT NULL,
  user_id text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  heartbeat_count bigint NOT NULL DEFAULT 1 CHECK (heartbeat_count > 0),
  PRIMARY KEY (tenant_id,request_id,user_id),
  FOREIGN KEY (tenant_id,request_id)
    REFERENCES commerce.owner_access_requests(tenant_id,request_id)
    ON DELETE CASCADE,
  CHECK (last_seen_at >= first_seen_at)
);
CREATE INDEX owner_access_presence_request_idx
  ON commerce.owner_access_presence(tenant_id,request_id,last_seen_at DESC);

CREATE TRIGGER owner_access_message_immutable
BEFORE UPDATE OR DELETE ON commerce.owner_access_messages
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
