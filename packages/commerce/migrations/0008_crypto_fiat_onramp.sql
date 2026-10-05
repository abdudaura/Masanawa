ALTER TABLE commerce.crypto_intents
  ADD COLUMN IF NOT EXISTS provider_invoice_id text NULL,
  ADD COLUMN IF NOT EXISTS checkout_url text NULL;

ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_operation_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_operation_check
    CHECK (operation IN ('deposit','withdraw','convert','buy'));

CREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_provider_invoice_unique
  ON commerce.crypto_intents(tenant_id, provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;

ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_conversion_metadata_check,
  DROP CONSTRAINT IF EXISTS crypto_intents_conversion_outcome_check,
  DROP CONSTRAINT IF EXISTS crypto_intents_operation_shape_check,
  DROP CONSTRAINT IF EXISTS crypto_intents_provider_invoice_metadata_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_conversion_metadata_check CHECK (
    operation = 'convert'
    OR provider_conversion_id IS NULL
  ),
  ADD CONSTRAINT crypto_intents_provider_invoice_metadata_check CHECK (
    (
      operation = 'buy'
      AND (
        (provider_invoice_id IS NULL AND checkout_url IS NULL)
        OR
        (provider_invoice_id IS NOT NULL AND checkout_url IS NOT NULL)
      )
    )
    OR
    (
      operation <> 'buy'
      AND provider_invoice_id IS NULL
      AND checkout_url IS NULL
    )
  ),
  ADD CONSTRAINT crypto_intents_conversion_outcome_check CHECK (
    provider_target_amount IS NULL
    OR (
      status = 'succeeded'
      AND (
        (
          operation = 'convert'
          AND provider_conversion_id IS NOT NULL
        )
        OR
        (
          operation = 'buy'
          AND provider_payment_id IS NOT NULL
        )
      )
    )
  ),
  ADD CONSTRAINT crypto_intents_operation_shape_check CHECK (
    (
      operation = 'deposit'
      AND target_asset IS NULL
      AND target_network IS NULL
      AND destination_address IS NULL
    )
    OR
    (
      operation = 'withdraw'
      AND target_asset IS NULL
      AND target_network IS NULL
      AND destination_address IS NOT NULL
    )
    OR
    (
      operation = 'convert'
      AND target_asset IS NOT NULL
      AND destination_address IS NULL
    )
    OR
    (
      operation = 'buy'
      AND network IS NULL
      AND target_asset IS NOT NULL
      AND destination_address IS NULL
    )
  );

ALTER TABLE commerce.crypto_ledger_entries
  DROP CONSTRAINT IF EXISTS crypto_ledger_entries_reason_check;

ALTER TABLE commerce.crypto_ledger_entries
  ADD CONSTRAINT crypto_ledger_entries_reason_check CHECK (
    reason IN (
      'provider-deposit',
      'provider-refund',
      'withdrawal-reserve',
      'withdrawal-release',
      'withdrawal-fee-reserve',
      'withdrawal-fee-release',
      'conversion-debit',
      'conversion-credit',
      'conversion-release',
      'fiat-purchase-credit',
      'fiat-purchase-refund',
      'adjustment'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS crypto_fiat_purchase_credit_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason = 'fiat-purchase-credit';

CREATE UNIQUE INDEX IF NOT EXISTS crypto_fiat_purchase_refund_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason = 'fiat-purchase-refund';
