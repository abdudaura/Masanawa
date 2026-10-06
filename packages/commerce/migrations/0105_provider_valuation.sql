CREATE TABLE commerce.twin_provider_valuation_policy_revisions (
  tenant_id text NOT NULL,
  valuation_key text NOT NULL CHECK (
    length(valuation_key) BETWEEN 1 AND 128
    AND valuation_key ~ '^[A-Za-z0-9][A-Za-z0-9:._-]*$'
  ),
  event_type text NOT NULL CHECK (
    event_type IN ('external-funding','commerce-purchase')
  ),
  revision bigint NOT NULL CHECK (revision > 0),
  enabled boolean NOT NULL,
  source_unit text NOT NULL CHECK (
    length(source_unit) BETWEEN 1 AND 64
    AND source_unit ~ '^[A-Za-z0-9][A-Za-z0-9:._-]*$'
  ),
  source_units_per_step bigint NOT NULL CHECK (source_units_per_step > 0),
  credit_units_per_step bigint NOT NULL CHECK (credit_units_per_step > 0),
  minimum_source_units bigint NOT NULL CHECK (minimum_source_units >= 0),
  maximum_base_credits bigint CHECK (maximum_base_credits >= 0),
  effective_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  PRIMARY KEY (tenant_id,valuation_key,event_type,revision)
);

CREATE INDEX twin_provider_valuation_active_idx
  ON commerce.twin_provider_valuation_policy_revisions(
    tenant_id,valuation_key,event_type,effective_at DESC,revision DESC
  );

CREATE TRIGGER twin_provider_valuation_policy_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_provider_valuation_policy_revisions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
