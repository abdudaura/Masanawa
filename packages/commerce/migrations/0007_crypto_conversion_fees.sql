ALTER TABLE commerce.crypto_intents
  ADD COLUMN IF NOT EXISTS target_network text NULL,
  ADD COLUMN IF NOT EXISTS provider_conversion_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_target_amount numeric(38,18) NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS crypto_provider_refund_debit_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, provider_reference)
  WHERE reason = 'provider-refund' AND provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_withdrawal_fee_ledger_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason IN ('withdrawal-fee-reserve','withdrawal-fee-release');

CREATE UNIQUE INDEX IF NOT EXISTS crypto_conversion_ledger_once
  ON commerce.crypto_ledger_entries(tenant_id, user_id, request_id, reason)
  WHERE reason IN ('conversion-debit','conversion-credit','conversion-release');


ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_provider_target_amount_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_provider_target_amount_check
    CHECK (provider_target_amount IS NULL OR provider_target_amount > 0);


ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_conversion_metadata_check,
  DROP CONSTRAINT IF EXISTS crypto_intents_withdrawal_metadata_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_conversion_metadata_check CHECK (
    (operation = 'convert')
    OR
    (provider_conversion_id IS NULL AND provider_target_amount IS NULL AND target_network IS NULL)
  ),
  ADD CONSTRAINT crypto_intents_withdrawal_metadata_check CHECK (
    (operation = 'withdraw')
    OR
    (provider_network_fee IS NULL AND withdrawal_fee_payer IS NULL)
  );

ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_conversion_outcome_check;

ALTER TABLE commerce.crypto_intents
  ADD CONSTRAINT crypto_intents_conversion_outcome_check CHECK (
    provider_target_amount IS NULL
    OR (
      operation = 'convert'
      AND status = 'succeeded'
      AND provider_conversion_id IS NOT NULL
    )
  );


ALTER TABLE commerce.crypto_intents
  DROP CONSTRAINT IF EXISTS crypto_intents_operation_shape_check;

ALTER TABLE commerce.crypto_intents
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
  );

CREATE OR REPLACE FUNCTION commerce.reject_crypto_financial_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'crypto financial evidence is immutable';
END;
$$;

DROP TRIGGER IF EXISTS crypto_ledger_entries_immutable
  ON commerce.crypto_ledger_entries;
CREATE TRIGGER crypto_ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON commerce.crypto_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION commerce.reject_crypto_financial_mutation();

DROP TRIGGER IF EXISTS crypto_provider_events_immutable
  ON commerce.crypto_provider_events;
CREATE TRIGGER crypto_provider_events_immutable
  BEFORE UPDATE OR DELETE ON commerce.crypto_provider_events
  FOR EACH ROW EXECUTE FUNCTION commerce.reject_crypto_financial_mutation();


CREATE UNIQUE INDEX IF NOT EXISTS crypto_intents_provider_payout_global_unique
  ON commerce.crypto_intents(provider_payout_id)
  WHERE provider_payout_id IS NOT NULL;
