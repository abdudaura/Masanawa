CREATE TABLE workflows.checkpoints (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  workflow_run_id text NOT NULL CHECK (workflow_run_id ~ '^workflow-run_'),
  sequence bigint NOT NULL CHECK (sequence > 0),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  workflow_version_id text NOT NULL CHECK (workflow_version_id ~ '^workflow-version_'),
  graph_signature text NOT NULL CHECK (graph_signature ~ '^sha256:[a-f0-9]{64}$'),
  parent_sequence bigint,
  workflow_run_revision bigint NOT NULL CHECK (workflow_run_revision > 0),
  payload jsonb NOT NULL,
  payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, workflow_run_id, sequence),
  FOREIGN KEY (
    tenant_id, workflow_run_id, workflow_version_id, graph_signature
  )
    REFERENCES workflows.workflow_runs(
      tenant_id, workflow_run_id, workflow_version_id, graph_signature
    ),
  FOREIGN KEY (tenant_id, workflow_run_id, parent_sequence)
    REFERENCES workflows.checkpoints(tenant_id, workflow_run_id, sequence)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (sequence = 1 AND parent_sequence IS NULL)
    OR
    (sequence > 1 AND parent_sequence IS NOT NULL AND parent_sequence < sequence)
  )
);

CREATE INDEX workflow_checkpoints_latest_idx
  ON workflows.checkpoints (
    tenant_id,
    workflow_run_id,
    workflow_version_id,
    graph_signature,
    schema_version,
    sequence DESC
  );

COMMENT ON TABLE workflows.checkpoints IS
  'Immutable committed WorkflowRun checkpoint snapshots. Restore requires exact schema, WorkflowVersion and graph signature compatibility.';
