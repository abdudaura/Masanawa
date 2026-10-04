CREATE TABLE IF NOT EXISTS commerce.crypto_intents (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  request_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('deposit','withdraw','convert')),
  asset text NOT NULL,
  network text NULL,
  amount numeric(38,18) NOT NULL CHECK (amount > 0),
  target_asset text NULL,
  destination_address text NULL,
  provider text NOT NULL CHECK (provider = 'nowpayments'),
  provider_payment_id text NULL,
  provider_payout_id text NULL,
  pay_address text NULL,
  provider_pay_amount numeric(38,18) NULL,
  provider_dispatch_started_at timestamptz NULL,
  status text NOT NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, request_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_request_unique\n  ON commerce.crypto_intents(tenant_id, request_id);\n\nCREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_provider_payment_unique
  ON commerce.crypto_intents(tenant_id, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_provider_payout_unique
  ON commerce.crypto_intents(tenant_id, provider_payout_id)
  WHERE provider_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crypto_intents_user_recent
  ON commerce.crypto_intents(tenant_id, user_id, created_at DESC, request_id DESC);

CREATE TABLE IF NOT EXISTS commerce.crypto_provider_events (
  tenant_id text NOT NULL,
  payload_hash text NOT NULL,
  user_id text NOT NULL,
  request_id text NOT NULL,
  provider_payment_id text NOT NULL,
  parent_payment_id text NULL,
  status text NOT NULL,
  observed_at timestamptz NOT NULL,
  definition jsonb NOT NULL,
  PRIMARY KEY (tenant_id, payload_hash),
  FOREIGN KEY (tenant_id, user_id, request_id)
    REFERENCES commerce.crypto_intents(tenant_id, user_id, request_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS crypto_provider_events_payment
  ON commerce.crypto_provider_events(tenant_id, provider_payment_id, observed_at);

CREATE TABLE IF NOT EXISTS commerce.crypto_ledger_entries (
  tenant_id text NOT NULL,
  ledger_entry_id text NOT NULL,
  user_id text NOT NULL,
  asset text NOT NULL,
  network text NULL,
  amount numeric(38,18) NOT NULL CHECK (amount > 0),
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  reason text NOT NULL CHECK (
    reason IN (
      'provider-deposit',
      'provider-refund',
      'withdrawal-reserve',
      'withdrawal-release',
      'conversion-debit',
      'conversion-credit',
      'adjustment'
    )
  ),
  request_id text NOT NULL,
  provider_reference text NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, ledger_entry_id),
  FOREIGN KEY (tenant_id, user_id, request_id)
    REFERENCES commerce.crypto_intents(tenant_id, user_id, request_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS crypto_provider_deposit_credit_once
  ON commerce.crypto_ledger_entries(tenant_id, provider_reference)
  WHERE reason = 'provider-deposit' AND provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_withdrawal_reserve_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason IN ('withdrawal-reserve','withdrawal-release');

CREATE INDEX IF NOT EXISTS crypto_ledger_balance_lookup
  ON commerce.crypto_ledger_entries(tenant_id, user_id, asset, network, created_at);
