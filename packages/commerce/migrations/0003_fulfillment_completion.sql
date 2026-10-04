CREATE TABLE commerce.fulfillment_completions (
  tenant_id text NOT NULL,
  fulfillment_id text NOT NULL CHECK (fulfillment_id ~ '^fulfillment_'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, fulfillment_id),
  FOREIGN KEY (tenant_id, fulfillment_id)
    REFERENCES commerce.fulfillments(tenant_id, fulfillment_id),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'fulfillmentId' IS NOT DISTINCT FROM fulfillment_id),
  CHECK (definition ->> 'state' = 'succeeded')
);

CREATE TRIGGER fulfillment_completion_immutable
BEFORE UPDATE OR DELETE ON commerce.fulfillment_completions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();
