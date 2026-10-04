CREATE TABLE workflows.schedules (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  schedule_key text NOT NULL,
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  target_node_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('once', 'interval')),
  first_at timestamptz NOT NULL,
  every_ms bigint,
  max_occurrences bigint,
  end_at timestamptz,
  state text NOT NULL CHECK (state IN ('active', 'completed')),
  next_sequence bigint NOT NULL CHECK (next_sequence > 0),
  next_due_at timestamptz,
  correlation_id text NOT NULL CHECK (correlation_id ~ '^correlation_'),
  destination text NOT NULL,
  definition_fingerprint text NOT NULL CHECK (definition_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, workflow_run_id, schedule_key),
  FOREIGN KEY (
    tenant_id, workflow_run_id, workflow_version_id, graph_signature
  )
    REFERENCES workflows.workflow_runs(
      tenant_id, workflow_run_id, workflow_version_id, graph_signature
    ),
  CHECK (
    (kind = 'once' AND every_ms IS NULL AND max_occurrences IS NULL)
    OR
    (
      kind = 'interval'
      AND every_ms IS NOT NULL
      AND every_ms > 0
      AND (max_occurrences IS NULL OR max_occurrences > 0)
    )
  ),
  CHECK (end_at IS NULL OR end_at >= first_at),
  CHECK (
    (state = 'active' AND next_due_at IS NOT NULL)
    OR
    (state = 'completed' AND next_due_at IS NULL)
  )
);

CREATE TABLE workflows.schedule_occurrences (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  schedule_key text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  due_at timestamptz NOT NULL,
  target_node_key text NOT NULL,
  materialized_at timestamptz NOT NULL,
  outbox_event_id text NOT NULL CHECK (outbox_event_id ~ '^outbox-event_'),
  PRIMARY KEY (tenant_id, workflow_run_id, schedule_key, sequence),
  FOREIGN KEY (tenant_id, workflow_run_id, schedule_key)
    REFERENCES workflows.schedules(tenant_id, workflow_run_id, schedule_key)
);

CREATE INDEX workflow_schedules_due_idx
  ON workflows.schedules (tenant_id, next_due_at, workflow_run_id, schedule_key)
  WHERE state = 'active';

COMMENT ON TABLE workflows.schedules IS
  'Durable workflow timer definitions pinned to exact WorkflowRun/WorkflowVersion/graph identity.';

COMMENT ON TABLE workflows.schedule_occurrences IS
  'Replay-safe materialized timer occurrences. Each occurrence owns one canonical outbox publication identity.';
