CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE security.policy_state (
  tenant_id text PRIMARY KEY CHECK (tenant_id ~ '^tenant_'),
  revision text NOT NULL CHECK (length(btrim(revision)) > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE security.authority_revocations (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  authority_context_id text NOT NULL CHECK (authority_context_id ~ '^authority-context_'),
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason_code text NOT NULL CHECK (length(btrim(reason_code)) > 0),
  PRIMARY KEY (tenant_id, authority_context_id)
);

CREATE TABLE security.approvals (
  approval_id text PRIMARY KEY CHECK (approval_id ~ '^approval_'),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  operation_id text NOT NULL CHECK (operation_id ~ '^operation_'),
  kind text NOT NULL CHECK (kind IN ('once', 'session', 'policy')),
  state text NOT NULL CHECK (
    state IN ('pending', 'approved', 'denied', 'expired', 'revoked', 'consumed')
  ),
  principal_key text NOT NULL CHECK (length(btrim(principal_key)) > 0),
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  action_version text NOT NULL CHECK (length(btrim(action_version)) > 0),
  resource_key text NOT NULL CHECK (length(btrim(resource_key)) > 0),
  arguments_fingerprint text NOT NULL CHECK (length(btrim(arguments_fingerprint)) > 0),
  risk_class text NOT NULL CHECK (length(btrim(risk_class)) > 0),
  policy_revision text NOT NULL CHECK (length(btrim(policy_revision)) > 0),
  requested_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  approver_key text,
  consumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > requested_at),
  CHECK (
    (state = 'pending' AND decided_at IS NULL AND approver_key IS NULL AND consumed_at IS NULL)
    OR
    (state IN ('approved', 'denied') AND decided_at IS NOT NULL AND approver_key IS NOT NULL AND consumed_at IS NULL)
    OR
    (state IN ('expired', 'revoked') AND consumed_at IS NULL)
    OR
    (state = 'consumed' AND decided_at IS NOT NULL AND approver_key IS NOT NULL AND consumed_at IS NOT NULL)
  )
);

CREATE INDEX approvals_operation_idx
  ON security.approvals (tenant_id, operation_id, requested_at);

CREATE INDEX approvals_pending_expiry_idx
  ON security.approvals (tenant_id, expires_at)
  WHERE state IN ('pending', 'approved');

COMMENT ON TABLE security.policy_state IS
  'Current tenant authorization policy revision. Consequential asynchronous work must re-check this revision before mutation or dispatch.';

COMMENT ON TABLE security.authority_revocations IS
  'Durable current-authority revocation evidence for admitted AuthorityContext identifiers.';

COMMENT ON TABLE security.approvals IS
  'Canonical exact-bound approval state. Allow-once consumption is atomic and terminal.';
