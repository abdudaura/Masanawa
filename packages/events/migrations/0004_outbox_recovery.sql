DROP INDEX IF EXISTS events.outbox_claim_idx;

CREATE INDEX outbox_claim_idx
  ON events.outbox (
    destination,
    state,
    available_at,
    lease_expires_at,
    created_at
  )
  WHERE state IN ('pending', 'retry-scheduled', 'claimed');

COMMENT ON INDEX events.outbox_claim_idx IS
  'Supports first claim, retry scheduling and expired-lease reclaim after worker/process loss.';
