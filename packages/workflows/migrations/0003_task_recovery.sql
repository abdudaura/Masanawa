ALTER TABLE workflows.tasks
  ADD COLUMN heartbeat_at timestamptz,
  ADD COLUMN adoption_count bigint NOT NULL DEFAULT 0 CHECK (adoption_count >= 0);

CREATE INDEX workflow_tasks_stale_lease_idx
  ON workflows.tasks (tenant_id, lease_expires_at, task_id)
  WHERE state = 'running';

COMMENT ON COLUMN workflows.tasks.heartbeat_at IS
  'Last successful liveness renewal for the current lease generation. leased_at is the initial liveness point before the first heartbeat.';

COMMENT ON COLUMN workflows.tasks.adoption_count IS
  'Number of expired-lease crash recoveries for this Task. Each adoption also increments lease_fence.';
