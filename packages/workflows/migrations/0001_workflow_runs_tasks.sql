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
  UNIQUE (tenant_id, workflow_run_id, workflow_version_id, graph_signature),
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
  FOREIGN KEY (
    tenant_id, workflow_run_id, workflow_version_id, graph_signature
  )
    REFERENCES workflows.workflow_runs(
      tenant_id, workflow_run_id, workflow_version_id, graph_signature
    ),
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


CREATE OR REPLACE FUNCTION workflows.validate_task_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_row workflows.tasks%ROWTYPE;
BEGIN
  IF NEW.lineage_depth = 0 THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO parent_row
    FROM workflows.tasks
   WHERE tenant_id = NEW.tenant_id
     AND task_id = NEW.parent_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow Task parent does not exist'
      USING ERRCODE = '23514';
  END IF;

  IF parent_row.workflow_run_id IS DISTINCT FROM NEW.workflow_run_id
     OR parent_row.workflow_version_id IS DISTINCT FROM NEW.workflow_version_id
     OR parent_row.graph_signature IS DISTINCT FROM NEW.graph_signature
     OR parent_row.root_task_id IS DISTINCT FROM NEW.root_task_id
     OR parent_row.lineage_depth + 1 <> NEW.lineage_depth THEN
    RAISE EXCEPTION 'Workflow Task lineage does not match parent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_tasks_validate_lineage
BEFORE INSERT OR UPDATE OF
  parent_task_id,
  root_task_id,
  lineage_depth,
  workflow_run_id,
  workflow_version_id,
  graph_signature
ON workflows.tasks
FOR EACH ROW
EXECUTE FUNCTION workflows.validate_task_lineage();

CREATE UNIQUE INDEX workflow_task_ready_outbox_once
  ON events.outbox (tenant_id, aggregate_id, event_type)
  WHERE aggregate_type = 'workflow-task'
    AND event_type = 'workflow.task.ready.v1';
