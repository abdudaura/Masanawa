ALTER TABLE events.inbox
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

ALTER TABLE events.inbox
  ADD CONSTRAINT inbox_processing_lease_check CHECK (
    (
      state = 'processing'
      AND lease_owner IS NOT NULL
      AND lease_expires_at IS NOT NULL
    )
    OR (
      state <> 'processing'
      AND lease_owner IS NULL
      AND lease_expires_at IS NULL
    )
  );

CREATE INDEX inbox_claim_idx
  ON events.inbox (
    tenant_id,
    namespace,
    state,
    lease_expires_at,
    received_at,
    event_id
  )
  WHERE state IN ('admitted', 'processing', 'failed');

COMMENT ON COLUMN events.inbox.lease_owner IS
  'Current durable inbox worker claim owner. Null outside processing state.';

COMMENT ON COLUMN events.inbox.lease_expires_at IS
  'Lease deadline for processing claims; expired claims may be fenced and reclaimed.';
