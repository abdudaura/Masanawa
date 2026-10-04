CREATE SCHEMA IF NOT EXISTS events;

CREATE TABLE IF NOT EXISTS events.channel_ingress (
  dedupe_key text PRIMARY KEY,
  evidence_hash text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  account_id text NOT NULL,
  external_event_id text NOT NULL,
  received_at timestamptz NOT NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_ingress_external_identity
  ON events.channel_ingress(channel, account_id, external_event_id);

CREATE INDEX IF NOT EXISTS channel_ingress_recent
  ON events.channel_ingress(received_at DESC);
