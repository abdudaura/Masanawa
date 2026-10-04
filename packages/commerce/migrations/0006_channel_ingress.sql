CREATE TABLE IF NOT EXISTS commerce.channel_ingress_events (
  channel text NOT NULL CHECK (channel IN ('whatsapp','telegram')),
  account_id text NOT NULL,
  dedupe_key text NOT NULL,
  external_event_id text NOT NULL,
  evidence_hash text NOT NULL,
  received_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  PRIMARY KEY (channel, account_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS commerce_channel_ingress_received_idx
  ON commerce.channel_ingress_events(channel, account_id, received_at DESC);
