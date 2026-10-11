-- C06: optional push choices; the C08 inbox and events.outbox remain authoritative.
-- Expand-only migration. AF00 owns registry and must check PG18 fresh/upgrade + checksums.
CREATE TABLE IF NOT EXISTS notifications.fan_delivery_preferences (
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  fan_user_id text NOT NULL CHECK (length(fan_user_id) BETWEEN 1 AND 128),
  kind text NOT NULL CHECK (kind IN
    ('comment_reply','room_answer','followed_post','subscription','wallet','case_update')),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, fan_user_id, kind)
);
-- Missing row means OPTED OUT of optional push, never removal of an inbox entry.
-- Account erasure/retention migration must include this fan-private preferences table.
