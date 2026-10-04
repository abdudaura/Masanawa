ALTER TABLE workflows.tasks
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_fence bigint NOT NULL DEFAULT 0 CHECK (lease_fence >= 0),
  ADD COLUMN leased_at timestamptz,
  ADD COLUMN lease_expires_at timestamptz;

ALTER TABLE workflows.tasks
  ADD CONSTRAINT workflow_tasks_lease_shape CHECK (
    (
      state <> 'running'
      AND lease_owner IS NULL
      AND leased_at IS NULL
      AND lease_expires_at IS NULL
    )
    OR
    (
      state = 'running'
      AND lease_owner IS NOT NULL
      AND leased_at IS NOT NULL
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > leased_at
    )
  );

CREATE INDEX workflow_tasks_checkout_idx
  ON workflows.tasks (tenant_id, state, created_at, task_id)
  WHERE state = 'ready';

COMMENT ON COLUMN workflows.tasks.lease_fence IS
  'Monotonic checkout fence. Every new lease increments this value; stale workers must not mutate a Task with an older fence.';
