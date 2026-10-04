CREATE TABLE workflows.task_retry_state (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  task_id text NOT NULL CHECK (task_id ~ '^task_'),
  policy_key text NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 20),
  completed_attempts integer NOT NULL CHECK (
    completed_attempts BETWEEN 1 AND max_attempts
  ),
  disposition text NOT NULL CHECK (
    disposition IN (
      'retry-scheduled',
      'retry-ready',
      'dead-letter',
      'needs-attention'
    )
  ),
  next_attempt_at timestamptz,
  last_failure_code text NOT NULL,
  last_failure_message text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES workflows.tasks(tenant_id, task_id),
  CHECK (
    (disposition = 'retry-scheduled' AND next_attempt_at IS NOT NULL)
    OR
    (disposition <> 'retry-scheduled' AND next_attempt_at IS NULL)
  ),
  CHECK (updated_at >= created_at)
);

CREATE INDEX workflow_task_retry_due_idx
  ON workflows.task_retry_state (
    tenant_id,
    disposition,
    next_attempt_at,
    task_id
  )
  WHERE disposition = 'retry-scheduled';

COMMENT ON TABLE workflows.task_retry_state IS
  'Durable retry custody for Workflow Tasks. retry-scheduled waits until next_attempt_at; retry-ready has been promoted back to Task ready; dead-letter is terminal exhaustion/terminal failure; needs-attention pauses for operator/human handling.';
