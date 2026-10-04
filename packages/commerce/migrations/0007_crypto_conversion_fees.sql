ALTER TABLE commerce.crypto_intents
  ADD COLUMN IF NOT EXISTS target_network text NULL,
  ADD COLUMN IF NOT EXISTS provider_conversion_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_network_fee numeric(38,18) NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_fee_payer text NULL;

ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_provider_network_fee_check,
  DROP CONSTRAINT IF EXISTS crypto_intents_withdrawal_fee_payer_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_provider_network_fee_check
    CHECK (provider_network_fee IS NULL OR provider_network_fee >= 0),
  ADD CONSTRAINT crypto_intents_withdrawal_fee_payer_check
    CHECK (
      (provider_network_fee IS NULL AND withdrawal_fee_payer IS NULL)
      OR
      (
        provider_network_fee IS NOT NULL
        AND withdrawal_fee_payer IN ('user','platform')
      )
    );

CREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_provider_conversion_unique
  ON commerce.crypto_intents(tenant_id, provider_conversion_id)
  WHERE provider_conversion_id IS NOT NULL;

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
      'adjustment'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS crypto_withdrawal_fee_ledger_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason IN ('withdrawal-fee-reserve','withdrawal-fee-release');

CREATE UNIQUE INDEX IF NOT EXISTS crypto_conversion_ledger_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason IN ('conversion-debit','conversion-credit','conversion-release');
