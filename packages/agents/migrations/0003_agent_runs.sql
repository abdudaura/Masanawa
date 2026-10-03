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
