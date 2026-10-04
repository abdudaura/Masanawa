CREATE TABLE workflows.task_retry_state (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  task_id text NOT NULL CHECK (task_id ~ '^task_'),
  failure_count integer NOT NULL CHECK (failure_count >= 1),
  disposition text NOT NULL CHECK (
    disposition IN ('retry-scheduled', 'ready', 'dead-letter', 'needs-attention')
  ),
  reason_code text NOT NULL,
  safe_error_code text NOT NULL,
  safe_error_message text NOT NULL,
  next_attempt_at timestamptz,
  last_failure_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES workflows.tasks(tenant_id, task_id),
  CHECK (
    (disposition = 'retry-scheduled' AND next_attempt_at IS NOT NULL)
    OR
    (disposition <> 'retry-scheduled' AND next_attempt_at IS NULL)
  )
);

CREATE INDEX workflow_task_retry_due_idx
  ON workflows.task_retry_state (tenant_id, next_attempt_at, task_id)
  WHERE disposition = 'retry-scheduled';

COMMENT ON TABLE workflows.task_retry_state IS
  'Current deterministic retry/dead-letter/needs-attention disposition for a Workflow Task. Uncertain outcomes must not be auto-retried.';
