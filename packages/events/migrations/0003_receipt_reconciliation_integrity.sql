ALTER TABLE events.operations
  ADD CONSTRAINT operations_tenant_operation_key
  UNIQUE (tenant_id, operation_id);

ALTER TABLE events.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_id_fkey;

ALTER TABLE events.idempotency_records
  ADD CONSTRAINT idempotency_records_tenant_operation_fkey
  FOREIGN KEY (tenant_id, operation_id)
  REFERENCES events.operations (tenant_id, operation_id);

ALTER TABLE events.external_receipts
  DROP CONSTRAINT external_receipts_operation_id_fkey;

ALTER TABLE events.external_receipts
  ADD CONSTRAINT external_receipts_tenant_operation_fkey
  FOREIGN KEY (tenant_id, operation_id)
  REFERENCES events.operations (tenant_id, operation_id);

ALTER TABLE events.reconciliation_cases
  DROP CONSTRAINT reconciliation_cases_operation_id_fkey;

ALTER TABLE events.reconciliation_cases
  ADD CONSTRAINT reconciliation_cases_tenant_operation_fkey
  FOREIGN KEY (tenant_id, operation_id)
  REFERENCES events.operations (tenant_id, operation_id);

DROP INDEX events.external_receipts_provider_ref_idx;

ALTER TABLE events.external_receipts
  ADD COLUMN observation_key text;

UPDATE events.external_receipts
   SET observation_key = 'legacy:' || external_receipt_id
 WHERE observation_key IS NULL;

ALTER TABLE events.external_receipts
  ALTER COLUMN observation_key SET NOT NULL;

ALTER TABLE events.external_receipts
  ADD CONSTRAINT external_receipts_observation_key_nonempty
  CHECK (length(btrim(observation_key)) > 0);

CREATE UNIQUE INDEX external_receipts_observation_key_idx
  ON events.external_receipts (tenant_id, provider, observation_key);

CREATE INDEX external_receipts_provider_ref_idx
  ON events.external_receipts (
    tenant_id,
    provider,
    provider_reference,
    observed_at DESC
  )
  WHERE provider_reference IS NOT NULL;

CREATE INDEX external_receipts_operation_idx
  ON events.external_receipts (tenant_id, operation_id, observed_at, created_at);

COMMENT ON COLUMN events.external_receipts.observation_key IS
  'Provider-adapter stable idempotency identity for one immutable receipt observation. Multiple observations may share provider_reference.';
