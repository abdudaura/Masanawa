CREATE SCHEMA IF NOT EXISTS workflows;

CREATE TABLE workflows.workflow_runs (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  workflow_id text NOT NULL CHECK (workflow_id ~ '^workflow_'),
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  initiated_by_user_id text CHECK (
    initiated_by_user_id IS NULL OR initiated_by_user_id ~ '^user_'
  ),
  state text NOT NULL CHECK (
    state IN ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled')
  ),
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  started_at timestamptz,
  terminal_at timestamptz,
  wait_reason text,
  failure_code text,
  failure_message text,
  cancellation_reason text,
  PRIMARY KEY (tenant_id, workflow_run_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (state = 'pending' AND started_at IS NULL)
    OR
    (state IN ('running', 'waiting', 'completed', 'failed') AND started_at IS NOT NULL)
    OR
    (state = 'cancelled')
  ),
  CHECK ((state = 'waiting') = (wait_reason IS NOT NULL)),
  CHECK ((state = 'failed') = (failure_code IS NOT NULL)),
  CHECK ((state = 'cancelled') = (cancellation_reason IS NOT NULL)),
  CHECK ((state IN ('completed', 'failed', 'cancelled')) = (terminal_at IS NOT NULL))
);

CREATE TABLE workflows.tasks (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  task_id text NOT NULL CHECK (task_id ~ '^task_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  node_key text NOT NULL,
  parent_task_id text CHECK (
    parent_task_id IS NULL OR parent_task_id ~ '^task_'
  ),
  root_task_id text NOT NULL CHECK (root_task_id ~ '^task_'),
  lineage_depth integer NOT NULL CHECK (lineage_depth BETWEEN 0 AND 32),
  state text NOT NULL CHECK (
    state IN ('pending', 'ready', 'running', 'waiting', 'completed', 'failed', 'cancelled')
  ),
  revision bigint NOT NULL CHECK (revision > 0),
  admission_request_id text NOT NULL CHECK (admission_request_id ~ '^request_'),
  admission_fingerprint text NOT NULL CHECK (
    admission_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  started_at timestamptz,
  terminal_at timestamptz,
  wait_reason text,
  failure_code text,
  failure_message text,
  cancellation_reason text,
  PRIMARY KEY (tenant_id, task_id),
  UNIQUE (tenant_id, admission_request_id),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, parent_task_id)
    REFERENCES workflows.tasks(tenant_id, task_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, root_task_id)
    REFERENCES workflows.tasks(tenant_id, task_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (lineage_depth = 0 AND parent_task_id IS NULL AND root_task_id = task_id)
    OR
    (lineage_depth > 0 AND parent_task_id IS NOT NULL AND root_task_id <> task_id)
  ),
  CHECK (updated_at >= created_at),
  CHECK (
    (state = 'pending' AND started_at IS NULL)
    OR
    (state = 'ready')
    OR
    (state IN ('running', 'waiting', 'completed', 'failed') AND started_at IS NOT NULL)
    OR
    (state = 'cancelled')
  ),
  CHECK ((state = 'waiting') = (wait_reason IS NOT NULL)),
  CHECK ((state = 'failed') = (failure_code IS NOT NULL)),
  CHECK ((state = 'cancelled') = (cancellation_reason IS NOT NULL)),
  CHECK ((state IN ('completed', 'failed', 'cancelled')) = (terminal_at IS NOT NULL))
);

CREATE INDEX workflow_tasks_run_state_idx
  ON workflows.tasks (tenant_id, workflow_run_id, state, created_at);

CREATE INDEX workflow_tasks_root_idx
  ON workflows.tasks (tenant_id, root_task_id, lineage_depth, created_at);

COMMENT ON TABLE workflows.workflow_runs IS
  'Canonical WorkflowRun state pinned to one exact WorkflowVersion graph signature.';

COMMENT ON TABLE workflows.tasks IS
  'Canonical Task state. Admission request identity is durable and each committed admission must be paired transactionally with canonical events.outbox publication.';
