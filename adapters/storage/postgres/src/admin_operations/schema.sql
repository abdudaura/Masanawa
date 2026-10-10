-- L-ADMIN source only. AF00 owns assigning a numbered, checksum-checked migration.
-- Never run against live data without staging restore/approval.
CREATE SCHEMA IF NOT EXISTS admin_operations;
CREATE TABLE IF NOT EXISTS admin_operations.flags (
 tenant_id text NOT NULL,
 flag_name text NOT NULL CHECK(flag_name IN ('posting','teaching','imports','calls','paid_joins')),
 enabled boolean NOT NULL DEFAULT FALSE,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 changed_by text,
 changed_at timestamptz,
 PRIMARY KEY(tenant_id,flag_name)
);
CREATE TABLE IF NOT EXISTS admin_operations.audit (
 tenant_id text NOT NULL,
 event_id uuid NOT NULL,
 actor_id text NOT NULL,
 action text NOT NULL,
 subject text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY(tenant_id,event_id)
);
CREATE INDEX IF NOT EXISTS admin_operations_audit_tenant_time ON admin_operations.audit(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS admin_operations.flag_requests (
 tenant_id text NOT NULL,
 actor_id text NOT NULL,
 request_key text NOT NULL,
 flag_name text NOT NULL,
 expected_revision bigint NOT NULL,
 requested_enabled boolean NOT NULL,
 reason text NOT NULL,
 result_revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY(tenant_id,actor_id,request_key)
);
-- Caller database role must be least-privileged and tenant identity verified by R1;
-- no staff authority or customer authentication is derived from these tables.
