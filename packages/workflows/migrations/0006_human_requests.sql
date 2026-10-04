ALTER TABLE workflows.tasks
  ADD CONSTRAINT workflow_tasks_human_request_binding_unique
  UNIQUE (
    tenant_id,
    task_id,
    workflow_run_id,
    workflow_version_id,
    graph_signature
  );

CREATE TABLE workflows.human_requests (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  human_request_id text NOT NULL CHECK (human_request_id ~ '^request_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  task_id text NOT NULL CHECK (task_id ~ '^task_'),
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (
    kind IN ('information', 'confirmation', 'approval')
  ),
  state text NOT NULL CHECK (
    state IN ('pending', 'answered', 'rejected', 'cancelled')
  ),
  prompt text NOT NULL CHECK (
    length(btrim(prompt)) > 0 AND char_length(prompt) <= 4000
  ),
  approval_id text CHECK (
    approval_id IS NULL OR approval_id ~ '^approval_'
  ),
  request_fingerprint text NOT NULL CHECK (
    request_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  response_payload jsonb,
  response_fingerprint text CHECK (
    response_fingerprint IS NULL OR response_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  requested_at timestamptz NOT NULL,
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, human_request_id),
  FOREIGN KEY (
    tenant_id,
    task_id,
    workflow_run_id,
    workflow_version_id,
    graph_signature
  )
    REFERENCES workflows.tasks (
      tenant_id,
      task_id,
      workflow_run_id,
      workflow_version_id,
      graph_signature
    ),
  CHECK ((kind = 'approval') = (approval_id IS NOT NULL)),
  CHECK (
    (state = 'pending'
      AND response_payload IS NULL
      AND response_fingerprint IS NULL
      AND resolved_at IS NULL)
    OR
    (state IN ('answered', 'rejected')
      AND response_payload IS NOT NULL
      AND response_fingerprint IS NOT NULL
      AND resolved_at IS NOT NULL)
    OR
    (state = 'cancelled'
      AND response_payload IS NULL
      AND response_fingerprint IS NULL
      AND resolved_at IS NOT NULL)
  ),
  CHECK (resolved_at IS NULL OR resolved_at >= requested_at)
);

CREATE INDEX workflow_human_requests_pending_idx
  ON workflows.human_requests (
    tenant_id,
    workflow_run_id,
    state,
    requested_at,
    human_request_id
  )
  WHERE state = 'pending';

CREATE UNIQUE INDEX workflow_human_request_one_pending_per_task
  ON workflows.human_requests (tenant_id, task_id)
  WHERE state = 'pending';

COMMENT ON TABLE workflows.human_requests IS
  'Durable human-in-loop request custody. Approval requests reference the canonical Security approval identity; this table does not duplicate approval authorization state.';
