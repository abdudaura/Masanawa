CREATE TABLE IF NOT EXISTS commerce.provider_webhook_events (
  provider text NOT NULL,
  fingerprint text NOT NULL,
  event_key text NOT NULL,
  received_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (provider, fingerprint)
);

CREATE INDEX IF NOT EXISTS commerce_provider_webhook_event_key_idx
  ON commerce.provider_webhook_events(provider, event_key, received_at DESC);

CREATE TABLE IF NOT EXISTS commerce.billing_fulfillments (
  fulfillment_reference text PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  state text NOT NULL CHECK (state IN (
    'ready','dispatching','checking','succeeded','failed','reversed','manual_review'
  )),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS commerce_billing_owner_idx
  ON commerce.billing_fulfillments(tenant_id, user_id, updated_at DESC);
