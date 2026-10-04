CREATE TABLE commerce.crypto_payment_intents (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^request_'),
  order_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  state text NOT NULL CHECK (state IN (
    'dispatching','waiting','confirming','confirmed','sending','partially_paid',
    'finished','failed','refunded','expired','manual_review'
  )),
  price_amount numeric(38,18) NOT NULL CHECK (price_amount > 0),
  price_currency text NOT NULL,
  pay_currency text NOT NULL,
  minimum_amount numeric(38,18) NOT NULL CHECK (minimum_amount > 0),
  estimated_amount numeric(38,18) NOT NULL CHECK (estimated_amount > 0),
  provider_payment_id text,
  purchase_id text,
  parent_payment_id text,
  pay_address text,
  pay_amount numeric(38,18),
  actually_paid numeric(38,18) NOT NULL DEFAULT 0 CHECK (actually_paid >= 0),
  last_evidence_hash text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  PRIMARY KEY (tenant_id, user_id, request_id),
  UNIQUE (tenant_id, order_id)
);

CREATE UNIQUE INDEX commerce_crypto_provider_payment_uq
  ON commerce.crypto_payment_intents(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX commerce_crypto_order_idx
  ON commerce.crypto_payment_intents(tenant_id, order_id);

CREATE TABLE commerce.provider_webhook_events (
  provider text NOT NULL,
  fingerprint text NOT NULL,
  event_key text NOT NULL,
  received_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (provider, fingerprint)
);

CREATE INDEX commerce_provider_webhook_event_key_idx
  ON commerce.provider_webhook_events(provider, event_key, received_at DESC);

CREATE TABLE commerce.billing_fulfillments (
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

CREATE INDEX commerce_billing_owner_idx
  ON commerce.billing_fulfillments(tenant_id, user_id, updated_at DESC);
