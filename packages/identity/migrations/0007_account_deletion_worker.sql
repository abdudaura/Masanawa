-- R12: durable and reviewable processing schedule. No account erasure is performed
-- by this migration. Immutable audits remain separate from retry metadata.
CREATE TABLE identity.account_deletion_worker_jobs (
  request_id uuid PRIMARY KEY REFERENCES identity.account_deletion_requests(request_id),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','leased','waiting')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  leased_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_outcome text CHECK (last_outcome IS NULL OR last_outcome IN
    ('financial_holds','review_required','retryable_error')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id,user_id,request_id)
    REFERENCES identity.account_deletion_requests(tenant_id,user_id,request_id),
  CHECK ((state='leased') = (lease_token IS NOT NULL AND leased_until IS NOT NULL))
);
CREATE INDEX account_deletion_worker_due_idx
  ON identity.account_deletion_worker_jobs(next_attempt_at,leased_until)
  WHERE state <> 'waiting';

CREATE TABLE identity.account_deletion_financial_scans (
  scan_id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES identity.account_deletion_requests(request_id),
  checked_at timestamptz NOT NULL,
  finding_codes jsonb NOT NULL CHECK (jsonb_typeof(finding_codes)='array'),
  admission_fenced boolean NOT NULL,
  cleared boolean NOT NULL,
  CHECK (NOT cleared OR (admission_fenced AND finding_codes='[]'::jsonb))
);
CREATE INDEX account_deletion_scans_request_idx
  ON identity.account_deletion_financial_scans(request_id,checked_at DESC);

CREATE TRIGGER account_deletion_scans_append_only
  BEFORE UPDATE OR DELETE ON identity.account_deletion_financial_scans
  FOR EACH ROW EXECUTE FUNCTION identity.reject_account_deletion_event_mutation();
