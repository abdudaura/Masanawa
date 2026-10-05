CREATE SCHEMA IF NOT EXISTS workflows;

CREATE TABLE workflows.tasks (
  tenant_id text NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  state text NOT NULL CHECK (
    state IN (
      'queued',
      'running',
      'waiting_approval',
      'waiting_external',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  workflow_run_id text,
  active_agent_run_id text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failure_code text,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, relationship_id)
    REFERENCES identity.relationships(tenant_id, relationship_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (state IN ('queued','running','waiting_approval','waiting_external')
      AND completed_at IS NULL AND failure_code IS NULL)
    OR
    (state = 'completed' AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'cancelled' AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'failed' AND completed_at = updated_at AND failure_code IS NOT NULL)
  )
);

CREATE TABLE workflows.workflow_runs (
  tenant_id text NOT NULL,
  workflow_run_id text NOT NULL,
  workflow_version_id text NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  state text NOT NULL CHECK (
    state IN (
      'queued',
      'running',
      'waiting_approval',
      'waiting_external',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  checkpoint_revision bigint NOT NULL DEFAULT 0 CHECK (checkpoint_revision >= 0),
  active_agent_run_id text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failure_code text,
  PRIMARY KEY (tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES workflows.tasks(tenant_id, task_id),
  FOREIGN KEY (tenant_id, relationship_id)
    REFERENCES identity.relationships(tenant_id, relationship_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (state IN ('queued','running','waiting_approval','waiting_external')
      AND completed_at IS NULL AND failure_code IS NULL)
    OR
    (state = 'completed' AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'cancelled' AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'failed' AND completed_at = updated_at AND failure_code IS NOT NULL)
  )
);

ALTER TABLE workflows.tasks
  ADD CONSTRAINT tasks_workflow_run_fk
  FOREIGN KEY (tenant_id, workflow_run_id)
  REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX tasks_relationship_state_idx
  ON workflows.tasks(tenant_id, relationship_id, state, updated_at DESC);

CREATE INDEX workflow_runs_task_idx
  ON workflows.workflow_runs(tenant_id, task_id, updated_at DESC);

CREATE OR REPLACE FUNCTION workflows.reject_task_identity_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Task revision must advance exactly once' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('completed','failed','cancelled') AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'Terminal Task state is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.workflow_run_id IS NOT NULL
     AND NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id THEN
    RAISE EXCEPTION 'Task WorkflowRun binding is immutable once assigned' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_immutable_identity
BEFORE UPDATE ON workflows.tasks
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_task_identity_update();

CREATE OR REPLACE FUNCTION workflows.reject_workflow_run_identity_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id
     OR NEW.workflow_version_id IS DISTINCT FROM OLD.workflow_version_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'WorkflowRun identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'WorkflowRun revision must advance exactly once' USING ERRCODE = '23514';
  END IF;
  IF NEW.checkpoint_revision < OLD.checkpoint_revision THEN
    RAISE EXCEPTION 'WorkflowRun checkpoint revision cannot move backward' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('completed','failed','cancelled') AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'Terminal WorkflowRun state is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_runs_immutable_identity
BEFORE UPDATE ON workflows.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_workflow_run_identity_update();


CREATE OR REPLACE FUNCTION workflows.reject_work_history_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Work history is immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER tasks_no_delete
BEFORE DELETE ON workflows.tasks
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_work_history_delete();

CREATE TRIGGER workflow_runs_no_delete
BEFORE DELETE ON workflows.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_work_history_delete();
