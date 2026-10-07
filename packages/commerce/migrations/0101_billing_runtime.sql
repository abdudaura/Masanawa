CREATE SCHEMA IF NOT EXISTS commerce;

CREATE TABLE IF NOT EXISTS commerce.billing_fulfillments (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  fulfillment_reference text NOT NULL CHECK (length(fulfillment_reference) BETWEEN 1 AND 128),
  biller_code text NOT NULL CHECK (length(biller_code) BETWEEN 1 AND 128),
  item_code text NOT NULL CHECK (length(item_code) BETWEEN 1 AND 128),
  item_name text NOT NULL CHECK (length(item_name) BETWEEN 1 AND 300),
  customer_id text NOT NULL CHECK (length(customer_id) BETWEEN 1 AND 200),
  customer_name text NULL CHECK (customer_name IS NULL OR length(customer_name) <= 300),
  amount text NOT NULL CHECK (amount ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'),
  currency text NOT NULL CHECK (currency = 'NGN'),
  revision integer NOT NULL CHECK (revision >= 1),
  state text NOT NULL CHECK (state IN (
    'ready','dispatching','checking','succeeded','failed','reversed','manual_review'
  )),
  provider_reference text NULL CHECK (provider_reference IS NULL OR length(provider_reference) <= 300),
  provider_status text NULL CHECK (provider_status IS NULL OR length(provider_status) <= 160),
  last_evidence_at timestamptz NULL,
  delivery_code text NULL CHECK (delivery_code IS NULL OR length(delivery_code) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,user_id,fulfillment_reference)
);

CREATE INDEX IF NOT EXISTS billing_fulfillments_reference_idx
  ON commerce.billing_fulfillments(fulfillment_reference);

CREATE TABLE IF NOT EXISTS commerce.billing_webhook_admissions (
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 80),
  fingerprint text NOT NULL CHECK (length(fingerprint) BETWEEN 1 AND 160),
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 300),
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider,fingerprint),
  UNIQUE (provider,event_key)
);
