-- PROPOSED U07 migration. F11 must assign/register once, after platform profiles.
CREATE SCHEMA IF NOT EXISTS work_artifacts;
CREATE TABLE work_artifacts.files (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  id text NOT NULL,
  request_id text NOT NULL,
  filename text NOT NULL CHECK (length(filename) BETWEEN 5 AND 84),
  mime_type text NOT NULL CHECK (mime_type = 'text/plain; charset=utf-8'),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  object_key text NOT NULL UNIQUE,
  provenance jsonb NOT NULL CHECK (provenance->>'kind' IN ('user-text','operator')),
  state text NOT NULL CHECK (state IN ('generating','ready','failed','revoked','deleting','deleted')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  grants jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(grants) = 'array' AND jsonb_array_length(grants) <= 20),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 days'),
  cleanup_checked_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,user_id,request_id),
  FOREIGN KEY (tenant_id,user_id) REFERENCES security.platform_user_profiles(tenant_id,user_id)
);
CREATE INDEX work_artifacts_owner_page ON work_artifacts.files(tenant_id,user_id,id);
CREATE INDEX work_artifacts_cleanup ON work_artifacts.files(cleanup_checked_at NULLS FIRST, expires_at);
CREATE TABLE work_artifacts.creation_budgets (
  tenant_id text NOT NULL,user_id text NOT NULL,day date NOT NULL,attempts integer NOT NULL CHECK(attempts BETWEEN 1 AND 20),
  PRIMARY KEY(tenant_id,user_id),
  FOREIGN KEY(tenant_id,user_id) REFERENCES security.platform_user_profiles(tenant_id,user_id)
);
-- Do not cascade metadata on account deletion before the private object is erased.
-- F08 invokes owner purge and confirms object deletion before deleting the profile FK.
