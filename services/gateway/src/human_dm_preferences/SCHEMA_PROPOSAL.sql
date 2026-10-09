-- U13 PROPOSAL ONLY. F15/F16 must assign an unclaimed ordered number after
-- C01 0016, C02 0017, C03 0019/0020. Not installed on production or main.
CREATE TABLE talks.human_dm_notification_preferences (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  conversation_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  mute_forever boolean NOT NULL DEFAULT false,
  muted_until timestamptz NULL,
  preview_mode text NOT NULL DEFAULT 'hidden' CHECK(preview_mode IN('hidden','generic')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,user_id,conversation_id),
  FOREIGN KEY(tenant_id,conversation_id) REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  CHECK(NOT(mute_forever AND muted_until IS NOT NULL))
);
-- At-most-once notification attempt on committed C03 event; sender retries do not duplicate.
-- A crash after claim can lose the hint. C03/C02 catch-up remains authoritative.
CREATE TABLE talks.human_dm_notification_claims (
  tenant_id text NOT NULL,
  recipient_user_id text NOT NULL,
  event_id bigint NOT NULL CHECK(event_id>0),
  conversation_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,recipient_user_id,event_id),
  FOREIGN KEY(tenant_id,recipient_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,conversation_id) REFERENCES talks.human_dm_conversations(tenant_id,conversation_id) ON DELETE CASCADE
);
-- Claims retention must be coordinated with C03 cursor/event retention watermarks.
-- No direct client SQL grants; access through existing authenticated Gateway only.
