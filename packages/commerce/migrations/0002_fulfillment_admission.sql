CREATE TABLE commerce.fulfillments (
  tenant_id text NOT NULL,
  fulfillment_id text NOT NULL CHECK (fulfillment_id ~ '^fulfillment_'),
  quote_id text NOT NULL CHECK (quote_id ~ '^quote_'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, fulfillment_id),
  UNIQUE (tenant_id, quote_id),
  FOREIGN KEY (tenant_id, quote_id)
    REFERENCES commerce.quotes(tenant_id, quote_id),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'fulfillmentId' IS NOT DISTINCT FROM fulfillment_id),
  CHECK (definition ->> 'quoteId' IS NOT DISTINCT FROM quote_id),
  CHECK (definition ->> 'state' = 'admitted')
);

CREATE TRIGGER fulfillment_admission_immutable
BEFORE UPDATE OR DELETE ON commerce.fulfillments
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();
