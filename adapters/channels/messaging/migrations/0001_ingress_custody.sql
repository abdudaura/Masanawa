CREATE SCHEMA IF NOT EXISTS channels;

CREATE TABLE channels.ingress_events (
  dedupe_key text PRIMARY KEY
    CHECK (length(btrim(dedupe_key)) BETWEEN 1 AND 256),
  evidence_hash text NOT NULL
    CHECK (length(btrim(evidence_hash)) BETWEEN 1 AND 256),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  account_id text NOT NULL
    CHECK (length(btrim(account_id)) BETWEEN 1 AND 256),
  external_event_id text NOT NULL
    CHECK (length(btrim(external_event_id)) BETWEEN 1 AND 512),
  received_at timestamptz NOT NULL,
  event jsonb NOT NULL
    CHECK (jsonb_typeof(event) = 'object'),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ingress_events_account_received_idx
  ON channels.ingress_events(channel, account_id, received_at DESC);

CREATE INDEX ingress_events_external_event_idx
  ON channels.ingress_events(channel, account_id, external_event_id);
