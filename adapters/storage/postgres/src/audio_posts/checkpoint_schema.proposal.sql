-- AF09 feature-owned SOURCE PROPOSAL. NOT an allocated migration.
-- AF00 must review permissions, social schema ordering and deployment triggers,
-- include this append-only DDL in the ONE canonical numbered migration sequence,
-- then bind the trusted existing worker. No client-facing tables or grants.
BEGIN;

CREATE TABLE social.audio_post_processing_checkpoint (
  job_key text PRIMARY KEY
    CHECK (job_key = 'published-audio'),
  tenant_cursor text NULL CHECK (
    tenant_cursor ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'
  ),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE social.audio_post_processing_checkpoint FROM PUBLIC;

COMMIT;
