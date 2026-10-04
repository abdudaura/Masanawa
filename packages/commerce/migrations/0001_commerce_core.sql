CREATE SCHEMA IF NOT EXISTS commerce;

CREATE TABLE commerce.offers (
  tenant_id text NOT NULL,
  offer_id text NOT NULL CHECK (offer_id ~ '^offer_'),
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, offer_id),
  UNIQUE (tenant_id, key)
);

CREATE TABLE commerce.offer_revisions (
  tenant_id text NOT NULL,
  offer_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, offer_id, revision),
  FOREIGN KEY (tenant_id, offer_id)
    REFERENCES commerce.offers(tenant_id, offer_id),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'offerId' IS NOT DISTINCT FROM offer_id),
  CHECK ((definition ->> 'revision')::bigint IS NOT DISTINCT FROM revision)
);

CREATE TABLE commerce.offer_heads (
  tenant_id text NOT NULL,
  offer_id text NOT NULL,
  current_revision bigint NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, offer_id),
  FOREIGN KEY (tenant_id, offer_id, current_revision)
    REFERENCES commerce.offer_revisions(tenant_id, offer_id, revision)
);

CREATE TABLE commerce.quotes (
  tenant_id text NOT NULL,
  quote_id text NOT NULL CHECK (quote_id ~ '^quote_'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, quote_id),
  CHECK (expires_at > created_at),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'quoteId' IS NOT DISTINCT FROM quote_id)
);

CREATE TABLE commerce.ledger_entries (
  tenant_id text NOT NULL,
  ledger_entry_id text NOT NULL CHECK (ledger_entry_id ~ '^ledger-entry_'),
  debit_kind text NOT NULL,
  debit_user_id text,
  debit_character_id text,
  credit_kind text NOT NULL,
  credit_user_id text,
  credit_character_id text,
  amount_credits bigint NOT NULL CHECK (amount_credits > 0),
  reason text NOT NULL,
  quote_id text,
  fulfillment_id text,
  created_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  PRIMARY KEY (tenant_id, ledger_entry_id),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'ledgerEntryId' IS NOT DISTINCT FROM ledger_entry_id)
);

CREATE INDEX commerce_ledger_debit_idx
  ON commerce.ledger_entries(
    tenant_id, debit_kind, debit_user_id, debit_character_id
  );

CREATE INDEX commerce_ledger_credit_idx
  ON commerce.ledger_entries(
    tenant_id, credit_kind, credit_user_id, credit_character_id
  );

CREATE OR REPLACE FUNCTION commerce.reject_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Commerce history is immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER offer_revision_immutable
BEFORE UPDATE OR DELETE ON commerce.offer_revisions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();

CREATE TRIGGER quote_immutable
BEFORE UPDATE OR DELETE ON commerce.quotes
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();

CREATE TRIGGER ledger_entry_immutable
BEFORE UPDATE OR DELETE ON commerce.ledger_entries
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();
