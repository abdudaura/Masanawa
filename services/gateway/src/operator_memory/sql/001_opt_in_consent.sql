-- U05 proposal ONLY. Migration registry and sequencing belong to F11/Work.
-- This stores consent, NOT memory content. Canonical records remain in memory.*.
CREATE SCHEMA IF NOT EXISTS operator_memory;
CREATE TABLE IF NOT EXISTS operator_memory.opt_in_consent (
  tenant_id text NOT NULL CHECK (tenant_id LIKE 'tenant_%'),
  user_id text NOT NULL CHECK (user_id LIKE 'user_%'),
  enabled boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
-- Subject to R12 deletion/retention migration review before activation.
REVOKE ALL ON SCHEMA operator_memory FROM PUBLIC;
REVOKE ALL ON TABLE operator_memory.opt_in_consent FROM PUBLIC;
