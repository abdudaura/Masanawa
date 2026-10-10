-- MSN foundation: OFF-CHAIN, nonwithdrawable platform unit; NOT a public token.
-- Never run this independently in production. The final migration sequencer
-- and F06 finance owner must review against competing C06 0110 migrations.
-- NGN is funding metadata only; it is NOT a second presented MSN wallet.
CREATE TABLE IF NOT EXISTS commerce.msn_issuances (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  quote_id text NOT NULL,
  funding_rail text NOT NULL CHECK (funding_rail IN ('NGN_FLUTTERWAVE','NOWPAYMENTS_CRYPTO')),
  funding_reference text NOT NULL,
  provider_settlement_id text NOT NULL,
  backing_asset text NOT NULL,
  backing_network text NOT NULL,
  backing_usd_micro numeric(38,0) NOT NULL CHECK (backing_usd_micro > 0),
  msn_credit_micro numeric(38,0) NOT NULL CHECK (msn_credit_micro > 0),
  price_per_msn_usd_micro numeric(38,0) NOT NULL CHECK (price_per_msn_usd_micro > 0),
  ngn_funding_kobo bigint NULL CHECK (ngn_funding_kobo > 0),
  verified_evidence_sha256 text NOT NULL CHECK (verified_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, quote_id),
  UNIQUE (tenant_id, quote_id, user_id),
  UNIQUE (tenant_id, funding_reference),
  -- Provider settlement identifiers are globally unique irrespective of tenant,
  -- otherwise one real deposit could be minted once per tenant.
  UNIQUE (provider_settlement_id),
  CHECK (
    (funding_rail = 'NGN_FLUTTERWAVE' AND ngn_funding_kobo IS NOT NULL)
    OR
    (funding_rail = 'NOWPAYMENTS_CRYPTO' AND ngn_funding_kobo IS NULL)
  ),
  CHECK (backing_asset ~ '^[A-Z0-9_-]{2,32}$'),
  CHECK (backing_network ~ '^[a-z0-9_-]{2,64}$')
);

-- Each issue is precisely one platform treasury liability debit and
-- one customer credit. Ledger entries cannot be changed or deleted.
CREATE TABLE IF NOT EXISTS commerce.msn_ledger_entries (
  tenant_id text NOT NULL,
  quote_id text NOT NULL,
  user_id text NOT NULL,
  entry_side text NOT NULL CHECK (entry_side IN ('platform','customer')),
  delta_micro numeric(38,0) NOT NULL CHECK (delta_micro <> 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, quote_id, entry_side),
  FOREIGN KEY (tenant_id, quote_id, user_id)
    REFERENCES commerce.msn_issuances(tenant_id, quote_id, user_id)
    ON DELETE RESTRICT,
  CHECK (
    (entry_side='platform' AND delta_micro < 0) OR
    (entry_side='customer' AND delta_micro > 0)
  )
);

CREATE INDEX IF NOT EXISTS msn_user_recent
 ON commerce.msn_issuances (tenant_id,user_id,created_at DESC,quote_id DESC);
CREATE INDEX IF NOT EXISTS msn_customer_balance
 ON commerce.msn_ledger_entries (tenant_id,user_id,entry_side)
 WHERE entry_side='customer';

-- Prevent in-place ledger mutation, including by an accidental maintenance job.
CREATE OR REPLACE FUNCTION commerce.msn_forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MSN ledger/issuance is append-only';
END;
$$;
DROP TRIGGER IF EXISTS msn_entry_immutable ON commerce.msn_ledger_entries;
CREATE TRIGGER msn_entry_immutable
 BEFORE UPDATE OR DELETE ON commerce.msn_ledger_entries
 FOR EACH ROW EXECUTE FUNCTION commerce.msn_forbid_mutation();
DROP TRIGGER IF EXISTS msn_issuance_immutable ON commerce.msn_issuances;
CREATE TRIGGER msn_issuance_immutable
 BEFORE UPDATE OR DELETE ON commerce.msn_issuances
 FOR EACH ROW EXECUTE FUNCTION commerce.msn_forbid_mutation();

-- A transaction that inserts only a customer's positive entry, or only a
-- treasury debit, must fail on COMMIT. Deferred because the two inserts
-- necessarily occur in separate SQL statements within one transaction.
CREATE OR REPLACE FUNCTION commerce.msn_assert_balanced_issue()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n integer;
  total numeric(38,0);
  positive_credit numeric(38,0);
  expected_credit numeric(38,0);
BEGIN
  SELECT count(*), COALESCE(sum(delta_micro),0),
         COALESCE(sum(delta_micro) FILTER (WHERE entry_side='customer'),0)
    INTO n, total, positive_credit
    FROM commerce.msn_ledger_entries
   WHERE tenant_id=NEW.tenant_id AND quote_id=NEW.quote_id;
  SELECT msn_credit_micro INTO expected_credit
    FROM commerce.msn_issuances
   WHERE tenant_id=NEW.tenant_id AND quote_id=NEW.quote_id;
  IF n <> 2 OR total <> 0 OR positive_credit IS DISTINCT FROM expected_credit THEN
    RAISE EXCEPTION 'MSN issue is not double-entry balanced';
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS msn_balanced_issue ON commerce.msn_ledger_entries;
CREATE CONSTRAINT TRIGGER msn_balanced_issue
 AFTER INSERT ON commerce.msn_ledger_entries
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION commerce.msn_assert_balanced_issue();

-- Users must never be permitted to mutate these tables through direct SQL.
-- API access requires an authenticated, authorized read service; qualified
-- issuance uses a privileged server worker AFTER externally verified backing.
