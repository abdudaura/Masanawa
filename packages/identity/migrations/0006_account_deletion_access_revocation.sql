-- R12: audit evidence for atomic access revocation.
-- Account-data erasure and provider cleanup are separate, later steps.
CREATE TABLE identity.account_deletion_access_revocations (
  request_id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  completed_at timestamptz NOT NULL,
  clearance_reference text NOT NULL CHECK (length(clearance_reference) BETWEEN 8 AND 160),
  clearance_checked_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, user_id, request_id)
    REFERENCES identity.account_deletion_requests(tenant_id, user_id, request_id)
);

-- Financial clearance must be current when the revocation is committed.
-- Its reference points to durable private reconciliation evidence.
CREATE OR REPLACE FUNCTION identity.reject_account_deletion_revocation_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Account deletion revocation evidence is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER account_deletion_revocations_append_only
  BEFORE UPDATE OR DELETE ON identity.account_deletion_access_revocations
  FOR EACH ROW EXECUTE FUNCTION identity.reject_account_deletion_revocation_mutation();
