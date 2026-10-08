-- C06: internal book transfer, not provider payout or Credits transfer.
ALTER TABLE commerce.crypto_intents DROP CONSTRAINT IF EXISTS crypto_intents_operation_check;
ALTER TABLE commerce.crypto_intents ADD CONSTRAINT crypto_intents_operation_check
 CHECK(operation IN ('deposit','withdraw','convert','buy','transfer'));
ALTER TABLE commerce.crypto_intents DROP CONSTRAINT IF EXISTS crypto_intents_operation_shape_check;
ALTER TABLE commerce.crypto_intents ADD CONSTRAINT crypto_intents_operation_shape_check CHECK (
 (operation='deposit' AND target_asset IS NULL AND target_network IS NULL AND destination_address IS NULL)
 OR (operation='withdraw' AND target_asset IS NULL AND target_network IS NULL AND destination_address IS NOT NULL)
 OR (operation='convert' AND target_asset IS NOT NULL AND destination_address IS NULL)
 OR (operation='buy' AND network IS NULL AND target_asset IS NOT NULL AND destination_address IS NULL)
 OR (operation='transfer' AND target_asset IS NULL AND target_network IS NULL AND destination_address IS NULL
     AND provider_payment_id IS NULL AND provider_payout_id IS NULL
     AND provider_invoice_id IS NULL AND provider_conversion_id IS NULL
     AND checkout_url IS NULL AND pay_address IS NULL AND provider_pay_amount IS NULL
     AND provider_network_fee IS NULL AND withdrawal_fee_payer IS NULL
     AND provider_dispatch_started_at IS NULL)
);
ALTER TABLE commerce.crypto_ledger_entries DROP CONSTRAINT IF EXISTS crypto_ledger_entries_reason_check;
ALTER TABLE commerce.crypto_ledger_entries ADD CONSTRAINT crypto_ledger_entries_reason_check CHECK (
 reason IN ('provider-deposit','provider-refund','withdrawal-reserve','withdrawal-release',
 'withdrawal-fee-reserve','withdrawal-fee-release','conversion-debit','conversion-credit',
 'conversion-release','fiat-purchase-credit','fiat-purchase-refund','adjustment',
 'internal-transfer-out','internal-transfer-in')
);
CREATE UNIQUE INDEX IF NOT EXISTS crypto_internal_ledger_once
 ON commerce.crypto_ledger_entries(tenant_id,user_id,request_id,reason)
 WHERE reason IN ('internal-transfer-out','internal-transfer-in');

CREATE TABLE IF NOT EXISTS commerce.crypto_internal_transfer_quotes (
 tenant_id text NOT NULL, sender_user_id text NOT NULL, request_id text NOT NULL,
 recipient_user_id text NOT NULL, recipient_label text NOT NULL,
 asset text NOT NULL, network text, amount numeric(38,18) NOT NULL CHECK (amount>0),
 approval_hash text NOT NULL CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
 failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','completed','expired','rejected')),
 recipient_request_id text, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,sender_user_id,request_id),
 UNIQUE (tenant_id,recipient_request_id),
 FOREIGN KEY (tenant_id,sender_user_id) REFERENCES identity.users(tenant_id,user_id),
 FOREIGN KEY (tenant_id,recipient_user_id) REFERENCES identity.users(tenant_id,user_id),
 CHECK(sender_user_id <> recipient_user_id),
 CHECK(expires_at > created_at),
 CHECK ((status='completed')=(completed_at IS NOT NULL)),
 CHECK ((status='completed')=(recipient_request_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS crypto_internal_recipient_history_idx
 ON commerce.crypto_internal_transfer_quotes(tenant_id,recipient_user_id,created_at DESC)
 WHERE status='completed';
CREATE INDEX IF NOT EXISTS crypto_internal_sender_window_idx
 ON commerce.crypto_internal_transfer_quotes(tenant_id,sender_user_id,created_at DESC);
CREATE OR REPLACE FUNCTION commerce.prevent_crypto_transfer_quote_tamper()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' OR OLD.status <> 'quoted' THEN
  RAISE EXCEPTION 'immutable crypto transfer evidence' USING ERRCODE='23514';
 END IF;
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
  OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
  OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
  OR NEW.request_id IS DISTINCT FROM OLD.request_id
  OR NEW.recipient_label IS DISTINCT FROM OLD.recipient_label
  OR NEW.asset IS DISTINCT FROM OLD.asset
  OR NEW.network IS DISTINCT FROM OLD.network
  OR NEW.amount IS DISTINCT FROM OLD.amount
  OR NEW.approval_hash IS DISTINCT FROM OLD.approval_hash
  OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'crypto transfer terms immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crypto_internal_transfer_quote_guard
 BEFORE UPDATE OR DELETE ON commerce.crypto_internal_transfer_quotes
 FOR EACH ROW EXECUTE FUNCTION commerce.prevent_crypto_transfer_quote_tamper();
