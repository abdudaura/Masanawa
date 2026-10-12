-- U02 isolated migration root (owner: operator-tasks).
-- NOT registered in the canonical Gateway migration manifest; F11 must elect an
-- available sequence and run it after identity/security foundation migrations.
CREATE SCHEMA IF NOT EXISTS operator_tasks;

CREATE TABLE IF NOT EXISTS operator_tasks.tasks (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  task_id text NOT NULL,
  request_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('private-assistant','persona-chat')),
  capability_id text NOT NULL,
  capability_version integer NOT NULL CHECK (capability_version >= 1),
  argument_digest text NOT NULL CHECK (argument_digest ~ '^[a-f0-9]{64}$'),
  phase text NOT NULL CHECK (phase IN
    ('proposed','clarifying','prepared','awaiting_approval','running',
     'reconciling','succeeded','failed','cancelled')),
  version integer NOT NULL CHECK (version >= 1),
  operation_class text CHECK (operation_class IN ('read','draft','send','financial')),
  operation_id text,
  terms_digest text CHECK (terms_digest IS NULL OR terms_digest ~ '^[a-f0-9]{64}$'),
  approval_digest text CHECK (approval_digest IS NULL OR approval_digest ~ '^[a-f0-9]{64}$'),
  approval_session_digest text CHECK (approval_session_digest IS NULL OR approval_session_digest ~ '^[a-f0-9]{64}$'),
  approval_expires_at timestamptz,
  receipt_ref text,
  error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,task_id),
  UNIQUE (tenant_id,user_id,request_id),
  UNIQUE (tenant_id,user_id,operation_id),
  CHECK (phase <> 'succeeded' OR (receipt_ref IS NOT NULL AND operation_id IS NOT NULL)),
  CHECK (phase <> 'awaiting_approval'
         OR (approval_digest IS NOT NULL AND approval_session_digest IS NOT NULL
             AND approval_expires_at IS NOT NULL AND terms_digest IS NOT NULL)),
  CHECK (phase NOT IN ('running','reconciling') OR operation_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS operator_task_owner_history
  ON operator_tasks.tasks(tenant_id,user_id,created_at DESC,task_id DESC);

CREATE TABLE IF NOT EXISTS operator_tasks.events (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  task_id text NOT NULL,
  task_version integer NOT NULL CHECK (task_version >= 1),
  phase text NOT NULL CHECK (phase IN
    ('proposed','clarifying','prepared','awaiting_approval','running',
     'reconciling','succeeded','failed','cancelled')),
  occurred_at timestamptz NOT NULL,
  code text,
  PRIMARY KEY (tenant_id,user_id,task_id,task_version),
  FOREIGN KEY (tenant_id,user_id,task_id)
    REFERENCES operator_tasks.tasks (tenant_id,user_id,task_id)
    ON DELETE CASCADE
);
-- No grant to PUBLIC; user authentication and tenant/owner filters are mandatory
-- at the Gateway, and dedicated limited-privilege DB roles must be reviewed by F11.
