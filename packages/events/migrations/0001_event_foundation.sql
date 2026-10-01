CREATE SCHEMA IF NOT EXISTS events;

CREATE TABLE events.platform_events (
  event_id text PRIMARY KEY CHECK (event_id ~ '^event_'),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_revision bigint,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor jsonb,
  authority_ref text,
  correlation_id text NOT NULL CHECK (correlation_id ~ '^correlation_'),
  causation_id text CHECK (causation_id IS NULL OR causation_id ~ '^event_'),
  request_id text CHECK (request_id IS NULL OR request_id ~ '^request_'),
  workflow_run_id text CHECK (
    workflow_run_id IS NULL OR workflow_run_id ~ '^workflow-run_'
  ),
  character_session_id text CHECK (
    character_session_id IS NULL OR character_session_id ~ '^character-session_'
  ),
  provenance jsonb NOT NULL,
  sensitivity text NOT NULL CHECK (
    sensitivity IN ('public', 'internal', 'private', 'sensitive', 'restricted')
  ),
  payload jsonb NOT NULL
);

CREATE INDEX platform_events_aggregate_idx
  ON events.platform_events (tenant_id, aggregate_type, aggregate_id, recorded_at);

CREATE INDEX platform_events_correlation_idx
  ON events.platform_events (tenant_id, correlation_id, recorded_at);

CREATE TABLE events.audit_events (
  audit_event_id text PRIMARY KEY CHECK (audit_event_id ~ '^audit-event_'),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor jsonb,
  authority_ref text,
  correlation_id text NOT NULL CHECK (correlation_id ~ '^correlation_'),
  causation_event_id text CHECK (
    causation_event_id IS NULL OR causation_event_id ~ '^event_'
  ),
  sensitivity text NOT NULL CHECK (
    sensitivity IN ('public', 'internal', 'private', 'sensitive', 'restricted')
  ),
  payload jsonb NOT NULL
);

CREATE INDEX audit_events_aggregate_idx
  ON events.audit_events (tenant_id, aggregate_type, aggregate_id, recorded_at);

CREATE TABLE events.operations (
  operation_id text PRIMARY KEY CHECK (operation_id ~ '^operation_'),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  kind text NOT NULL,
  idempotency_key text NOT NULL,
  authority_scope_hash text NOT NULL,
  request_fingerprint text NOT NULL,
  state text NOT NULL CHECK (
    state IN (
      'prepared',
      'authorized',
      'dispatching',
      'dispatched',
      'accepted',
      'rejected',
      'partial',
      'unknown',
      'reconciling',
      'succeeded',
      'failed'
    )
  ),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0),
  provider text,
  provider_idempotency_key text,
  terminal_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, kind, idempotency_key, authority_scope_hash)
);

CREATE INDEX operations_state_idx
  ON events.operations (tenant_id, state, updated_at);

CREATE TABLE events.idempotency_records (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  operation_kind text NOT NULL,
  idempotency_key text NOT NULL,
  authority_scope_hash text NOT NULL,
  request_fingerprint text NOT NULL,
  operation_id text NOT NULL REFERENCES events.operations(operation_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation_kind, idempotency_key, authority_scope_hash)
);

CREATE INDEX idempotency_expiry_idx
  ON events.idempotency_records (expires_at);

CREATE TABLE events.external_receipts (
  external_receipt_id text PRIMARY KEY CHECK (
    external_receipt_id ~ '^external-receipt_'
  ),
  operation_id text NOT NULL REFERENCES events.operations(operation_id),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  provider text NOT NULL,
  provider_reference text,
  normalized_status text NOT NULL,
  payload_hash text,
  payload_ref text,
  observed_at timestamptz NOT NULL,
  verification_method text NOT NULL,
  provider_version text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX external_receipts_provider_ref_idx
  ON events.external_receipts (tenant_id, provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE events.reconciliation_cases (
  reconciliation_case_id text PRIMARY KEY CHECK (
    reconciliation_case_id ~ '^reconciliation-case_'
  ),
  operation_id text NOT NULL REFERENCES events.operations(operation_id),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  status text NOT NULL CHECK (
    status IN ('open', 'checking', 'resolved', 'needs-attention')
  ),
  reason_code text NOT NULL,
  safe_retry boolean NOT NULL DEFAULT false,
  next_action text,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX reconciliation_active_operation_idx
  ON events.reconciliation_cases (operation_id)
  WHERE status IN ('open', 'checking', 'needs-attention');

CREATE TABLE events.outbox (
  outbox_event_id text PRIMARY KEY CHECK (outbox_event_id ~ '^outbox-event_'),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  event_id text NOT NULL CHECK (event_id ~ '^event_'),
  event_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  correlation_id text NOT NULL CHECK (correlation_id ~ '^correlation_'),
  causation_id text CHECK (causation_id IS NULL OR causation_id ~ '^event_'),
  destination text NOT NULL,
  state text NOT NULL CHECK (
    state IN (
      'pending',
      'claimed',
      'dispatched',
      'acknowledged',
      'retry-scheduled',
      'unknown',
      'dead-letter'
    )
  ) DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload jsonb NOT NULL,
  terminal_receipt_ref text,
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX outbox_claim_idx
  ON events.outbox (state, available_at, created_at)
  WHERE state IN ('pending', 'retry-scheduled');

CREATE TABLE events.inbox (
  namespace text NOT NULL,
  event_id text NOT NULL,
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  provider text NOT NULL,
  account_ref text NOT NULL,
  payload_hash text NOT NULL,
  payload_ref text,
  state text NOT NULL CHECK (
    state IN ('admitted', 'processing', 'completed', 'failed', 'dead-letter')
  ),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  tombstone_until timestamptz NOT NULL,
  safe_error_code text,
  PRIMARY KEY (namespace, event_id)
);

CREATE INDEX inbox_recovery_idx
  ON events.inbox (tenant_id, state, received_at)
  WHERE state IN ('admitted', 'processing', 'failed');

COMMENT ON TABLE events.operations IS
  'Canonical consequential operation identity. Unknown/partial dispatch outcomes reconcile this same row; they do not create a fresh operation.';

COMMENT ON TABLE events.outbox IS
  'Transactional publication custody. Consumers must be idempotent and respect attempt/fence state.';

COMMENT ON TABLE events.inbox IS
  'Durable external-event admission and replay tombstone state; provider acknowledgement follows admission where redelivery is available.';
