-- C08 inbox projection; NOT a second push/outbox authority.
-- AF00 registers this immutable migration root after disposable PG18 validation.
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE TABLE IF NOT EXISTS notifications.fan_inbox (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  notification_id text NOT NULL,
  source_event_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('comment_reply','room_answer','followed_post','subscription','wallet','case_update')),
  target_kind text NOT NULL CHECK (target_kind IN ('post','comment','room','subscription','wallet','case')),
  target_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz,
  PRIMARY KEY (tenant_id, fan_user_id, notification_id),
  UNIQUE (tenant_id, fan_user_id, source_event_id),
  CHECK (char_length(tenant_id) BETWEEN 1 AND 128),
  CHECK (char_length(fan_user_id) BETWEEN 1 AND 128),
  CHECK (char_length(source_event_id) BETWEEN 1 AND 128),
  CHECK (char_length(target_id) BETWEEN 1 AND 128)
);
CREATE INDEX IF NOT EXISTS fan_inbox_recent
ON notifications.fan_inbox (tenant_id, fan_user_id, created_at DESC, notification_id DESC);
-- No cascade delete, financial rewrite, direct fan INSERT grant or push subscription here.
