CREATE TABLE workflows.task_operation_bindings (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  task_id text NOT NULL CHECK (task_id ~ '^task_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  role text NOT NULL CHECK (
    role IN ('primary', 'verification', 'compensation')
  ),
  operation_id text NOT NULL CHECK (operation_id ~ '^operation_'),
  binding_fingerprint text NOT NULL CHECK (
    binding_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  bound_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, task_id, role),
  UNIQUE (tenant_id, operation_id),
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
  FOREIGN KEY (operation_id)
    REFERENCES events.operations(operation_id)
);

CREATE OR REPLACE FUNCTION workflows.validate_task_operation_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  operation_tenant text;
BEGIN
  SELECT tenant_id
    INTO operation_tenant
    FROM events.operations
   WHERE operation_id = NEW.operation_id;

  IF NOT FOUND OR operation_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Workflow Task Operation tenant binding mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_task_operation_tenant_guard
BEFORE INSERT OR UPDATE OF tenant_id, operation_id
ON workflows.task_operation_bindings
FOR EACH ROW
EXECUTE FUNCTION workflows.validate_task_operation_tenant();

CREATE INDEX workflow_task_operation_run_idx
  ON workflows.task_operation_bindings (
    tenant_id,
    workflow_run_id,
    task_id,
    role
  );

COMMENT ON TABLE workflows.task_operation_bindings IS
  'Immutable workflow reference to canonical events.operations truth. Provider state, receipts and reconciliation remain owned by events/providers and are projected at read time.';
