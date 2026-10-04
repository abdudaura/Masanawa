CREATE TABLE commerce.billing_quotes (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  quote_id text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('quoted','confirmed','checkout-created','funded','reserved','succeeded','refund-pending','refund-dispatching','refund-submitted','refunded','expired')),
  category_code text,
  biller_code text NOT NULL CHECK (length(btrim(biller_code)) BETWEEN 1 AND 128),
  item_code text NOT NULL CHECK (length(btrim(item_code)) BETWEEN 1 AND 128),
  item_name text NOT NULL CHECK (length(btrim(item_name)) BETWEEN 1 AND 300),
  customer_id text NOT NULL CHECK (length(btrim(customer_id)) BETWEEN 1 AND 200),
  service_amount_kobo bigint NOT NULL CHECK (service_amount_kobo > 0),
  fee_amount_kobo bigint NOT NULL CHECK (fee_amount_kobo >= 0),
  total_amount_kobo bigint NOT NULL CHECK (total_amount_kobo = service_amount_kobo + fee_amount_kobo),
  currency text NOT NULL CHECK (currency = 'NGN'),
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  checkout_tx_ref text UNIQUE,
  checkout_url text,
  provider_transaction_id text UNIQUE,
  provider_reference text,
  bill_provider_reference text,
  payment_verified_at timestamptz,
  fulfillment_reference text UNIQUE,
  settlement_state text CHECK (settlement_state IN ('succeeded','failed','reversed')),
  refund_reference text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,quote_id),
  CHECK (expires_at > created_at),
  CHECK ((payment_verified_at IS NULL) = (provider_transaction_id IS NULL)),
  CHECK (checkout_url IS NULL OR checkout_tx_ref IS NOT NULL),
  CHECK (refund_reference IS NULL OR state IN ('refund-submitted','refunded'))
);
CREATE INDEX billing_quotes_user_history_idx ON commerce.billing_quotes(tenant_id,user_id,created_at DESC,quote_id DESC);
CREATE OR REPLACE FUNCTION commerce.reject_billing_quote_term_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.revision IS DISTINCT FROM OLD.revision
     OR NEW.category_code IS DISTINCT FROM OLD.category_code OR NEW.biller_code IS DISTINCT FROM OLD.biller_code
     OR NEW.item_code IS DISTINCT FROM OLD.item_code OR NEW.item_name IS DISTINCT FROM OLD.item_name
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.service_amount_kobo IS DISTINCT FROM OLD.service_amount_kobo
     OR NEW.fee_amount_kobo IS DISTINCT FROM OLD.fee_amount_kobo OR NEW.total_amount_kobo IS DISTINCT FROM OLD.total_amount_kobo
     OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Billing quote economic terms are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_quotes_immutable_terms BEFORE UPDATE ON commerce.billing_quotes
FOR EACH ROW EXECUTE FUNCTION commerce.reject_billing_quote_term_update();
