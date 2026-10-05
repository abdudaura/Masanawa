CREATE TABLE workflows.workflow_executor_leases (
  tenant_id text NOT NULL,
  workflow_run_id text NOT NULL,
  holder_id text NOT NULL
    CHECK (
      length(holder_id) BETWEEN 1 AND 200
      AND holder_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]*$'
    ),
  fence bigint NOT NULL
    CHECK (fence > 0 AND fence < 9007199254740991),
  state text NOT NULL CHECK (state IN ('held', 'released')),
  acquired_at timestamptz NOT NULL,
  renewed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  PRIMARY KEY (tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, workflow_run_id)
    REFERENCES workflows.workflow_runs(tenant_id, workflow_run_id),
  CHECK (renewed_at >= acquired_at),
  CHECK (expires_at > renewed_at),
  CHECK (
    (state = 'held' AND released_at IS NULL)
    OR
    (state = 'released' AND released_at IS NOT NULL AND released_at >= renewed_at)
  )
);

CREATE OR REPLACE FUNCTION workflows.guard_executor_lease_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Workflow executor lease fence history cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id
     OR NEW.fence < OLD.fence
     OR NEW.fence > OLD.fence + 1
     OR (
       NEW.fence = OLD.fence
       AND (
         NEW.holder_id IS DISTINCT FROM OLD.holder_id
         OR NEW.acquired_at IS DISTINCT FROM OLD.acquired_at
         OR NEW.renewed_at < OLD.renewed_at
         OR (
           OLD.state = 'released'
           AND NEW IS DISTINCT FROM OLD
         )
         OR (
           OLD.state = 'held'
           AND NEW.state = 'released'
           AND (
             NEW.renewed_at IS DISTINCT FROM OLD.renewed_at
             OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
           )
         )
         OR (
           OLD.state = 'held'
           AND NEW.state = 'held'
           AND NEW.released_at IS NOT NULL
         )
       )
     )
     OR (
       NEW.fence = OLD.fence + 1
       AND (
         NEW.state <> 'held'
         OR NEW.released_at IS NOT NULL
         OR NEW.acquired_at < OLD.renewed_at
         OR NEW.renewed_at <> NEW.acquired_at
       )
     ) THEN
    RAISE EXCEPTION 'Workflow executor lease update violates fence history'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_executor_leases_history_guard
BEFORE UPDATE OR DELETE ON workflows.workflow_executor_leases
FOR EACH ROW
EXECUTE FUNCTION workflows.guard_executor_lease_history();
