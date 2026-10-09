-- C09 private 1:1 calls. Additive migration after 0020; integration branch only.
-- Depends on C01 0016 and C02 0017; preserve encrypted/C03 history.
-- Calls live under human DM authority, not public Talks nor agent voice.
CREATE TABLE talks.human_private_calls (
  tenant_id text NOT NULL,
  call_id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  caller_user_id text NOT NULL,
  callee_user_id text NOT NULL,
  client_request_id text NOT NULL CHECK (client_request_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{11,127}$'),
  kind text NOT NULL CHECK (kind IN ('audio','video')),
  state text NOT NULL DEFAULT 'ringing'
    CHECK (state IN ('ringing','active','declined','cancelled','missed','ended')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '45 seconds'),
  answered_at timestamptz,
  ended_at timestamptz,
  PRIMARY KEY (tenant_id,call_id),
  UNIQUE (tenant_id,caller_user_id,client_request_id),
  FOREIGN KEY (tenant_id,conversation_id)
    REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,caller_user_id)
    REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,callee_user_id)
    REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  CHECK (caller_user_id <> callee_user_id),
  CHECK (answered_at IS NULL OR state IN ('active','ended')),
  CHECK (ended_at IS NULL OR state IN ('declined','cancelled','missed','ended'))
);
CREATE INDEX human_private_calls_caller_idx ON talks.human_private_calls
  (tenant_id,caller_user_id,created_at DESC);
CREATE INDEX human_private_calls_callee_idx ON talks.human_private_calls
  (tenant_id,callee_user_id,created_at DESC);
CREATE INDEX human_private_calls_open_idx ON talks.human_private_calls
  (tenant_id,created_at) WHERE state IN ('ringing','active');
CREATE INDEX human_private_calls_expiry_idx ON talks.human_private_calls
  (expires_at,call_id) WHERE state IN ('ringing','active');
-- A durable, no-PII hint outbox for the existing R14/FCM worker to consume.
-- This table alone DOES NOT deliver incoming calls.
CREATE TABLE talks.human_call_signal_outbox (
  tenant_id text NOT NULL,
  signal_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id uuid NOT NULL,
  recipient_user_id text NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('ringing','active','declined','cancelled','missed','ended')
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz,
  lease_token uuid,
  leased_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  FOREIGN KEY (tenant_id,call_id)
    REFERENCES talks.human_private_calls(tenant_id,call_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,recipient_user_id)
    REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX human_call_signal_outbox_pending_idx ON talks.human_call_signal_outbox
  (tenant_id,created_at,signal_id) WHERE delivered_at IS NULL;
-- No call audio/video recording, transcoding, transcripts, chat content,
-- provider token or phone numbers are retained in this schema.
