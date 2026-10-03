CREATE TABLE agents.agent_runs (
  tenant_id text NOT NULL,
  agent_run_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  character_session_id text NOT NULL,
  character_version_id text NOT NULL,
  parent_agent_run_id text,
  root_agent_run_id text NOT NULL,
  lineage_depth integer NOT NULL CHECK (lineage_depth BETWEEN 0 AND 32),
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  task_id text,
  workflow_run_id text,
  operation_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(operation_ids) = 'array'
      AND jsonb_array_length(operation_ids) <= 64
    ),
  state text NOT NULL DEFAULT 'running'
    CHECK (state IN ('running', 'completed', 'failed')),
  failure_code text,
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, agent_run_id),
  FOREIGN KEY (tenant_id, character_session_id)
    REFERENCES agents.character_sessions(tenant_id, character_session_id),
  FOREIGN KEY (tenant_id, parent_agent_run_id)
    REFERENCES agents.agent_runs(tenant_id, agent_run_id),
  FOREIGN KEY (tenant_id, root_agent_run_id)
    REFERENCES agents.agent_runs(tenant_id, agent_run_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (lineage_depth = 0 AND parent_agent_run_id IS NULL AND root_agent_run_id = agent_run_id)
    OR
    (lineage_depth > 0 AND parent_agent_run_id IS NOT NULL AND root_agent_run_id <> agent_run_id)
  ),
  CHECK (updated_at >= started_at),
  CHECK (
    (state = 'running' AND completed_at IS NULL AND failure_code IS NULL)
    OR
    (state = 'completed' AND completed_at = updated_at AND failure_code IS NULL)
    OR
    (state = 'failed' AND completed_at = updated_at AND failure_code IS NOT NULL)
  )
);

CREATE INDEX agent_runs_session_idx
  ON agents.agent_runs(tenant_id, character_session_id, started_at);

CREATE INDEX agent_runs_root_idx
  ON agents.agent_runs(tenant_id, root_agent_run_id, lineage_depth, started_at);

CREATE UNIQUE INDEX agent_runs_request_idx
  ON agents.agent_runs(tenant_id, request_id);


CREATE OR REPLACE FUNCTION agents.reject_agent_run_identity_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.agent_run_id IS DISTINCT FROM OLD.agent_run_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.character_session_id IS DISTINCT FROM OLD.character_session_id
     OR NEW.character_version_id IS DISTINCT FROM OLD.character_version_id
     OR NEW.parent_agent_run_id IS DISTINCT FROM OLD.parent_agent_run_id
     OR NEW.root_agent_run_id IS DISTINCT FROM OLD.root_agent_run_id
     OR NEW.lineage_depth IS DISTINCT FROM OLD.lineage_depth
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id
     OR NEW.operation_ids IS DISTINCT FROM OLD.operation_ids
     OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'AgentRun identity, lineage and trace references are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_runs_immutable_identity
BEFORE UPDATE ON agents.agent_runs
FOR EACH ROW
EXECUTE FUNCTION agents.reject_agent_run_identity_update();

CREATE OR REPLACE FUNCTION agents.reject_agent_run_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AgentRun history is immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER agent_runs_no_delete
BEFORE DELETE ON agents.agent_runs
FOR EACH ROW
EXECUTE FUNCTION agents.reject_agent_run_delete();
