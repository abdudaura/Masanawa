CREATE TABLE commerce.ngn_wallet_entries (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  entry_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  reason text NOT NULL CHECK (reason IN ('funding','bill-reserve','bill-refund','adjustment')),
  reference text NOT NULL CHECK (length(btrim(reference)) BETWEEN 1 AND 180),
  provider_transaction_id text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,entry_id),
  UNIQUE (tenant_id,user_id,reason,reference)
);
CREATE UNIQUE INDEX ngn_wallet_provider_transaction_unique
  ON commerce.ngn_wallet_entries(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX ngn_wallet_user_history_idx
  ON commerce.ngn_wallet_entries(tenant_id,user_id,created_at DESC,entry_id DESC);

CREATE TABLE commerce.ngn_funding_intents (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  funding_reference text NOT NULL,
  tx_ref text NOT NULL UNIQUE,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  state text NOT NULL CHECK (state IN ('creating','awaiting','credited','expired','failed')),
  account_number text,
  bank_name text,
  provider_order_ref text,
  provider_reference text,
  provider_transaction_id text UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,funding_reference),
  CHECK (expires_at > created_at),
  CHECK (
    (state='creating' AND account_number IS NULL AND bank_name IS NULL)
    OR
    (state IN ('awaiting','credited','expired') AND account_number IS NOT NULL AND bank_name IS NOT NULL)
    OR
    state='failed'
  )
);
CREATE INDEX ngn_funding_user_idx
  ON commerce.ngn_funding_intents(tenant_id,user_id,created_at DESC);

CREATE TABLE commerce.ngn_bill_reservations (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  quote_id text NOT NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  state text NOT NULL CHECK (state IN ('reserved','succeeded','refunded')),
  reserved_at timestamptz NOT NULL,
  settled_at timestamptz,
  PRIMARY KEY (tenant_id,user_id,quote_id)
);
