CREATE TABLE workflows.workflow_run_controls (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  control_request_id text NOT NULL CHECK (control_request_id ~ '^request_'),
  command_fingerprint text NOT NULL CHECK (
    command_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  mode text NOT NULL CHECK (mode IN ('cancel', 'supersede')),
  state text NOT NULL CHECK (
    state IN ('cancel-requested', 'cancelled', 'superseded')
  ),
  reason text NOT NULL CHECK (
    length(btrim(reason)) > 0 AND char_length(reason) <= 500
  ),
  superseded_by_workflow_run_id text CHECK (
    superseded_by_workflow_run_id IS NULL
    OR superseded_by_workflow_run_id ~ '^workflow-run_'
  ),
  compensation_state text NOT NULL CHECK (
    compensation_state IN (
      'none',
      'required',
      'compensating',
      'compensated',
      'failed'
    )
  ),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, workflow_run_id),
  UNIQUE (tenant_id, control_request_id),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, superseded_by_workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  CHECK (
    (mode = 'cancel' AND superseded_by_workflow_run_id IS NULL)
    OR
    (mode = 'supersede' AND superseded_by_workflow_run_id IS NOT NULL)
  ),
  CHECK (
    (state = 'superseded' AND mode = 'supersede')
    OR state <> 'superseded'
  ),
  CHECK (updated_at >= created_at)
);

CREATE TABLE workflows.workflow_compensation_steps (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  original_operation_id text NOT NULL CHECK (
    original_operation_id ~ '^operation_'
  ),
  compensation_operation_id text NOT NULL CHECK (
    compensation_operation_id ~ '^operation_'
  ),
  step_fingerprint text NOT NULL CHECK (
    step_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  state text NOT NULL CHECK (
    state IN ('planned', 'running', 'succeeded', 'failed')
  ),
  reason text NOT NULL CHECK (
    length(btrim(reason)) > 0 AND char_length(reason) <= 500
  ),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, workflow_run_id, original_operation_id),
  UNIQUE (tenant_id, compensation_operation_id),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  FOREIGN KEY (original_operation_id)
    REFERENCES events.operations(operation_id),
  FOREIGN KEY (compensation_operation_id)
    REFERENCES events.operations(operation_id),
  CHECK (original_operation_id <> compensation_operation_id),
  CHECK (updated_at >= created_at)
);

CREATE OR REPLACE FUNCTION workflows.guard_controlled_task_activation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state IN ('ready', 'running')
     AND EXISTS (
       SELECT 1
         FROM workflows.workflow_run_controls AS c
        WHERE c.tenant_id = NEW.tenant_id
          AND c.workflow_run_id = NEW.workflow_run_id
          AND c.state IN ('cancel-requested', 'cancelled', 'superseded')
     ) THEN
    RAISE EXCEPTION 'Workflow run no longer admits ready/running Task work'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_tasks_control_guard
BEFORE INSERT OR UPDATE OF state, workflow_run_id
ON workflows.tasks
FOR EACH ROW
EXECUTE FUNCTION workflows.guard_controlled_task_activation();

CREATE OR REPLACE FUNCTION workflows.validate_compensation_bindings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  original_tenant text;
  compensation_tenant text;
  original_state text;
  compensation_state text;
BEGIN
  SELECT tenant_id, state INTO original_tenant, original_state
    FROM events.operations
   WHERE operation_id = NEW.original_operation_id;
  SELECT tenant_id, state INTO compensation_tenant, compensation_state
    FROM events.operations
   WHERE operation_id = NEW.compensation_operation_id;

  IF original_tenant IS DISTINCT FROM NEW.tenant_id
     OR compensation_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Workflow compensation Operation tenant mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF original_state NOT IN (
       'accepted', 'partial', 'unknown', 'reconciling', 'succeeded'
     ) THEN
    RAISE EXCEPTION 'Original Operation state does not justify compensation'
      USING ERRCODE = '23514';
  END IF;

  IF compensation_state NOT IN ('prepared', 'authorized') THEN
    RAISE EXCEPTION 'Compensation Operation must be pre-dispatch'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM workflows.task_operation_bindings
     WHERE tenant_id = NEW.tenant_id
       AND workflow_run_id = NEW.workflow_run_id
       AND operation_id = NEW.original_operation_id
       AND role IN ('primary', 'verification')
  ) THEN
    RAISE EXCEPTION 'Original Operation is not bound to this WorkflowRun'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM workflows.task_operation_bindings
     WHERE tenant_id = NEW.tenant_id
       AND workflow_run_id = NEW.workflow_run_id
       AND operation_id = NEW.compensation_operation_id
       AND role = 'compensation'
  ) THEN
    RAISE EXCEPTION 'Compensation Operation is not bound to this WorkflowRun'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_compensation_binding_guard
BEFORE INSERT OR UPDATE OF
  tenant_id,
  workflow_run_id,
  original_operation_id,
  compensation_operation_id
ON workflows.workflow_compensation_steps
FOR EACH ROW
EXECUTE FUNCTION workflows.validate_compensation_bindings();

COMMENT ON TABLE workflows.workflow_run_controls IS
  'Durable cancellation/supersession truth. Running leased Tasks are never rewritten by control admission; finalization waits for them to leave running state.';

COMMENT ON TABLE workflows.workflow_compensation_steps IS
  'Forward-only compensation truth linking an original canonical Operation to a distinct canonical compensation Operation. Original history remains immutable.';
