-- C06: off-chain custody-backed internal transfers; independent of Credits and provider payouts.
CREATE TABLE commerce.crypto_internal_transfer_quotes (
  tenant_id text NOT NULL, quote_id text NOT NULL, quote_request_id text NOT NULL,
  sender_user_id text NOT NULL, recipient_user_id text NOT NULL,
  asset text NOT NULL, network text NULL,
  amount numeric(38,18) NOT NULL CHECK (amount > 0),
  fee numeric(38,18) NOT NULL CHECK (fee = 0),
  policy_revision text NOT NULL CHECK (length(policy_revision) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,quote_id),
  UNIQUE (tenant_id,sender_user_id,quote_request_id),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '5 minutes')
);
CREATE TABLE commerce.crypto_internal_transfers (
  tenant_id text NOT NULL, transfer_id text NOT NULL, quote_id text NOT NULL,
  request_id text NOT NULL, sender_user_id text NOT NULL, recipient_user_id text NOT NULL,
  asset text NOT NULL, network text NULL,
  amount numeric(38,18) NOT NULL CHECK (amount > 0),
  fee numeric(38,18) NOT NULL CHECK (fee = 0),
  policy_revision text NOT NULL, completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,transfer_id),
  UNIQUE (tenant_id,sender_user_id,request_id),
  UNIQUE (tenant_id,quote_id),
  FOREIGN KEY (tenant_id,quote_id)
    REFERENCES commerce.crypto_internal_transfer_quotes(tenant_id,quote_id) ON DELETE RESTRICT,
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE TABLE commerce.crypto_internal_transfer_entries (
  tenant_id text NOT NULL, transfer_id text NOT NULL, side text NOT NULL
    CHECK (side IN ('debit','credit')),
  user_id text NOT NULL, asset text NOT NULL, network text NULL,
  amount numeric(38,18) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,transfer_id,side),
  FOREIGN KEY (tenant_id,transfer_id)
    REFERENCES commerce.crypto_internal_transfers(tenant_id,transfer_id) ON DELETE RESTRICT
);
CREATE INDEX crypto_internal_transfer_entries_balance_idx ON
  commerce.crypto_internal_transfer_entries(tenant_id,user_id,asset,network,created_at);
CREATE INDEX crypto_internal_transfer_received_idx ON
  commerce.crypto_internal_transfers(tenant_id,recipient_user_id,completed_at DESC);
CREATE VIEW commerce.crypto_all_ledger_entries AS
  SELECT tenant_id,user_id,asset,network,amount,direction
    FROM commerce.crypto_ledger_entries
  UNION ALL
  SELECT tenant_id,user_id,asset,network,amount,side AS direction
    FROM commerce.crypto_internal_transfer_entries;
CREATE TRIGGER crypto_internal_quotes_immutable
  BEFORE UPDATE OR DELETE ON commerce.crypto_internal_transfer_quotes
  FOR EACH ROW EXECUTE FUNCTION commerce.reject_crypto_financial_mutation();
CREATE TRIGGER crypto_internal_transfers_immutable
  BEFORE UPDATE OR DELETE ON commerce.crypto_internal_transfers
  FOR EACH ROW EXECUTE FUNCTION commerce.reject_crypto_financial_mutation();
CREATE TRIGGER crypto_internal_entries_immutable
  BEFORE UPDATE OR DELETE ON commerce.crypto_internal_transfer_entries
  FOR EACH ROW EXECUTE FUNCTION commerce.reject_crypto_financial_mutation();
CREATE FUNCTION commerce.assert_internal_transfer_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE entries_count integer; debit_count integer; credit_count integer;
BEGIN
  SELECT COUNT(*)::integer,
    COUNT(*) FILTER (WHERE side='debit' AND user_id=t.sender_user_id
                    AND e.asset=t.asset AND e.network IS NOT DISTINCT FROM t.network
                    AND e.amount=t.amount)::integer,
    COUNT(*) FILTER (WHERE side='credit' AND user_id=t.recipient_user_id
                    AND e.asset=t.asset AND e.network IS NOT DISTINCT FROM t.network
                    AND e.amount=t.amount)::integer
    INTO entries_count,debit_count,credit_count
    FROM commerce.crypto_internal_transfers t
    LEFT JOIN commerce.crypto_internal_transfer_entries e
      ON e.tenant_id=t.tenant_id AND e.transfer_id=t.transfer_id
   WHERE t.tenant_id=NEW.tenant_id AND t.transfer_id=NEW.transfer_id
   GROUP BY t.tenant_id,t.transfer_id;
  IF entries_count <> 2 OR debit_count <> 1 OR credit_count <> 1 THEN
    RAISE EXCEPTION 'crypto.internal.transfer_unbalanced';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER crypto_internal_transfer_balance
  AFTER INSERT ON commerce.crypto_internal_transfers DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION commerce.assert_internal_transfer_balanced();
