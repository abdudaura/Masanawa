CREATE TABLE workflows.usage_evidence (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  usage_event_id text NOT NULL CHECK (usage_event_id ~ '^event_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  task_id text CHECK (task_id IS NULL OR task_id ~ '^task_'),
  operation_id text CHECK (
    operation_id IS NULL OR operation_id ~ '^operation_'
  ),
  provider_id text CHECK (
    provider_id IS NULL OR provider_id ~ '^provider_'
  ),
  category text NOT NULL CHECK (
    category IN ('inference', 'tool', 'provider', 'workflow')
  ),
  provider_key text,
  model_key text,
  input_units bigint NOT NULL CHECK (input_units >= 0),
  output_units bigint NOT NULL CHECK (output_units >= 0),
  cost_micros bigint NOT NULL CHECK (cost_micros >= 0),
  latency_ms bigint NOT NULL CHECK (latency_ms BETWEEN 0 AND 86400000),
  evidence_key text NOT NULL,
  evidence_fingerprint text NOT NULL CHECK (
    evidence_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, usage_event_id),
  UNIQUE (tenant_id, evidence_key),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, task_id)
    REFERENCES workflows.tasks(tenant_id, task_id),
  FOREIGN KEY (operation_id)
    REFERENCES events.operations(operation_id)
);

CREATE INDEX workflow_usage_run_idx
  ON workflows.usage_evidence (
    tenant_id,
    workflow_run_id,
    occurred_at,
    usage_event_id
  );

CREATE OR REPLACE FUNCTION workflows.validate_usage_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  task_run text;
  operation_tenant text;
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT workflow_run_id
      INTO task_run
      FROM workflows.tasks
     WHERE tenant_id = NEW.tenant_id
       AND task_id = NEW.task_id;

    IF NOT FOUND OR task_run IS DISTINCT FROM NEW.workflow_run_id THEN
      RAISE EXCEPTION 'Workflow usage Task binding mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.operation_id IS NOT NULL THEN
    SELECT tenant_id
      INTO operation_tenant
      FROM events.operations
     WHERE operation_id = NEW.operation_id;

    IF NOT FOUND OR operation_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Workflow usage Operation tenant mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_usage_scope_guard
BEFORE INSERT OR UPDATE OF
  tenant_id,
  workflow_run_id,
  task_id,
  operation_id
ON workflows.usage_evidence
FOR EACH ROW
EXECUTE FUNCTION workflows.validate_usage_scope();

CREATE OR REPLACE FUNCTION workflows.reject_usage_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Workflow usage evidence is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER workflow_usage_no_update
BEFORE UPDATE ON workflows.usage_evidence
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_usage_mutation();

CREATE TRIGGER workflow_usage_no_delete
BEFORE DELETE ON workflows.usage_evidence
FOR EACH ROW
EXECUTE FUNCTION workflows.reject_usage_mutation();

COMMENT ON TABLE workflows.usage_evidence IS
  'Immutable privacy-safe workflow usage/cost evidence. Stores IDs, measured units, micros and latency only; never prompts, response bodies, credentials or secrets.';
