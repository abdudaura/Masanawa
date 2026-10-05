CREATE SCHEMA IF NOT EXISTS workflows;

CREATE TABLE workflows.tasks (
  tenant_id text NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
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
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failure_code text,
  PRIMARY KEY (tenant_id, task_id),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  FOREIGN KEY (tenant_id, relationship_id)
    REFERENCES identity.relationships(tenant_id, relationship_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (state IN ('queued','running','waiting_approval','waiting_external')
      AND completed_at IS NULL AND failure_code IS NULL)
    OR
    (state IN ('completed','cancelled')
      AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'failed'
      AND completed_at = updated_at AND failure_code IS NOT NULL)
  )
);

CREATE INDEX tasks_relationship_state_idx
  ON workflows.tasks(
    tenant_id,
    relationship_id,
    state,
    updated_at DESC
  );

CREATE TABLE workflows.workflow_runs (
  tenant_id text NOT NULL,
  workflow_run_id text NOT NULL,
  workflow_version_id text NOT NULL,
  task_id text,
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
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  checkpoint_revision bigint NOT NULL DEFAULT 0
    CHECK (checkpoint_revision >= 0 AND checkpoint_revision < 9007199254740991),
  pending_approval_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(pending_approval_ids) = 'array'
      AND jsonb_array_length(pending_approval_ids) <= 64
    ),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failure_code text,
  PRIMARY KEY (tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES workflows.tasks(tenant_id, task_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  FOREIGN KEY (tenant_id, relationship_id)
    REFERENCES identity.relationships(tenant_id, relationship_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  CHECK (updated_at >= created_at),
  CHECK (
    (state IN ('queued','running','waiting_external')
      AND completed_at IS NULL
      AND failure_code IS NULL
      AND jsonb_array_length(pending_approval_ids) = 0)
    OR
    (state = 'waiting_approval'
      AND completed_at IS NULL
      AND failure_code IS NULL
      AND jsonb_array_length(pending_approval_ids) > 0)
    OR
    (state IN ('completed','cancelled')
      AND completed_at = updated_at
      AND failure_code IS NULL
      AND jsonb_array_length(pending_approval_ids) = 0)
    OR
    (state = 'failed'
      AND completed_at = updated_at
      AND failure_code IS NOT NULL
      AND jsonb_array_length(pending_approval_ids) = 0)
  )
);

CREATE INDEX workflow_runs_relationship_state_idx
  ON workflows.workflow_runs(
    tenant_id,
    relationship_id,
    state,
    updated_at DESC
  );

ALTER TABLE workflows.tasks
  ADD CONSTRAINT tasks_workflow_run_fk
  FOREIGN KEY (tenant_id, workflow_run_id)
  REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE workflows.workflow_checkpoints (
  tenant_id text NOT NULL,
  workflow_run_id text NOT NULL,
  checkpoint_revision bigint NOT NULL
    CHECK (checkpoint_revision > 0 AND checkpoint_revision < 9007199254740991),
  graph_signature text NOT NULL
    CHECK (length(btrim(graph_signature)) BETWEEN 1 AND 256),
  committed_state jsonb NOT NULL
    CHECK (jsonb_typeof(committed_state) = 'object'),
  executor_state jsonb NOT NULL
    CHECK (jsonb_typeof(executor_state) = 'object'),
  edge_state jsonb NOT NULL
    CHECK (jsonb_typeof(edge_state) = 'object'),
  pending_approval_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(pending_approval_ids) = 'array'
      AND jsonb_array_length(pending_approval_ids) <= 64
    ),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, workflow_run_id, checkpoint_revision),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id)
);

CREATE INDEX workflow_checkpoints_latest_idx
  ON workflows.workflow_checkpoints(
    tenant_id,
    workflow_run_id,
    checkpoint_revision DESC
  );

CREATE OR REPLACE FUNCTION workflows.guard_task_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Task history cannot be destructively deleted'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.revision <> OLD.revision + 1
     OR NEW.updated_at < OLD.updated_at
     OR OLD.state IN ('completed','failed','cancelled')
     OR (
       NEW.state IS DISTINCT FROM OLD.state
       AND NOT (
         (OLD.state = 'queued' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'running' AND NEW.state IN (
           'waiting_approval','waiting_external','completed','failed','cancelled'
         ))
         OR
         (OLD.state = 'waiting_approval' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'waiting_external' AND NEW.state IN (
           'running','completed','failed','cancelled'
         ))
       )
     ) THEN
    RAISE EXCEPTION 'Task identity/history is immutable and transitions require an active revision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_history_guard
BEFORE UPDATE OR DELETE ON workflows.tasks
FOR EACH ROW
EXECUTE FUNCTION workflows.guard_task_history();

CREATE OR REPLACE FUNCTION workflows.guard_workflow_run_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WorkflowRun history cannot be destructively deleted'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id
     OR NEW.workflow_version_id IS DISTINCT FROM OLD.workflow_version_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.revision <> OLD.revision + 1
     OR NEW.checkpoint_revision < OLD.checkpoint_revision
     OR NEW.checkpoint_revision > OLD.checkpoint_revision + 1
     OR NEW.updated_at < OLD.updated_at
     OR OLD.state IN ('completed','failed','cancelled')
     OR (
       NEW.checkpoint_revision = OLD.checkpoint_revision + 1
       AND (
         NEW.state IS DISTINCT FROM OLD.state
         OR NEW.pending_approval_ids IS DISTINCT FROM OLD.pending_approval_ids
       )
     )
     OR (
       NEW.state IS DISTINCT FROM OLD.state
       AND NOT (
         (OLD.state = 'queued' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'running' AND NEW.state IN (
           'waiting_approval','waiting_external','completed','failed','cancelled'
         ))
         OR
         (OLD.state = 'waiting_approval' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'waiting_external' AND NEW.state IN (
           'running','completed','failed','cancelled'
         ))
       )
     ) THEN
    RAISE EXCEPTION 'WorkflowRun identity/history is immutable and updates require an active revision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_runs_history_guard
BEFORE UPDATE OR DELETE ON workflows.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION workflows.guard_workflow_run_history();

CREATE OR REPLACE FUNCTION workflows.reject_checkpoint_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Workflow checkpoints are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER workflow_checkpoints_immutable
BEFORE UPDATE OR DELETE ON workflows.workflow_checkpoints
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_checkpoint_mutation();
