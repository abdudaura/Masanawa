-- R12: durable deletion requests without erasing financial evidence.
-- Applied only through the versioned identity migration runner.
CREATE TABLE identity.account_deletion_requests (
  request_id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  phase text NOT NULL DEFAULT 'requested'
    CHECK (phase IN ('requested', 'identity-verified', 'awaiting-settlement',
                     'processing', 'completed', 'failed')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  outstanding_obligations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(outstanding_obligations) = 'array'),
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, user_id, request_id),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  CHECK (updated_at >= created_at),
  CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 128)
);

CREATE INDEX account_deletion_pending_idx
  ON identity.account_deletion_requests (phase, updated_at)
  WHERE phase <> 'completed';

-- Append-only compliance-safe state history: no OTPs, balances, contacts, or private chat.
CREATE TABLE identity.account_deletion_events (
  request_id uuid NOT NULL REFERENCES identity.account_deletion_requests(request_id),
  revision bigint NOT NULL CHECK (revision > 0),
  phase text NOT NULL
    CHECK (phase IN ('requested', 'identity-verified', 'awaiting-settlement',
                     'processing', 'completed', 'failed')),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (request_id, revision)
);

CREATE OR REPLACE FUNCTION identity.reject_account_deletion_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Account deletion audit events are append-only'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER account_deletion_events_append_only
  BEFORE UPDATE OR DELETE ON identity.account_deletion_events
  FOR EACH ROW EXECUTE FUNCTION identity.reject_account_deletion_event_mutation();

-- Deletion verification cannot reuse sign-in OTPs.
-- The hash is a purpose-bound HMAC computed by the trusted Gateway.
CREATE TABLE identity.account_deletion_challenges (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  request_id uuid NOT NULL,
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  resend_after timestamptz NOT NULL,
  consumed_at timestamptz,
  PRIMARY KEY (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id,request_id)
    REFERENCES identity.account_deletion_requests(tenant_id,user_id,request_id),
  CHECK (expires_at > created_at AND resend_after > created_at)
);
