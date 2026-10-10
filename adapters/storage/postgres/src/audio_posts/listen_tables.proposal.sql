-- AF09 Published Talks qualified listens — FEATURE-LOCAL PROPOSAL ONLY.
-- DO NOT AUTO-APPLY. AF00 allocates an append-only sequence after installing
-- the canonical social.audio_posts table. Review schema, policy and rollback
-- before integrating. This file is not an active migration registry entry.
-- PostgreSQL 13+ provides gen_random_uuid() natively.
CREATE TABLE social.audio_post_listen_sessions (
  tenant_id text NOT NULL,
  listen_id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  viewer_account_id text NOT NULL,
  post_revision integer NOT NULL CHECK (post_revision >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1000 AND 180000),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '10 minutes'),
  accepted boolean NOT NULL DEFAULT false,
  counted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, listen_id),
  FOREIGN KEY (tenant_id, post_id)
    REFERENCES social.audio_posts(tenant_id, post_id) ON DELETE CASCADE,
  CHECK (expires_at > issued_at),
  CHECK (NOT counted OR accepted)
);
CREATE INDEX audio_post_listen_sessions_expiry
  ON social.audio_post_listen_sessions(expires_at);
CREATE INDEX audio_post_listen_sessions_viewer_post
  ON social.audio_post_listen_sessions
  (tenant_id, post_id, viewer_account_id);

-- A counted listen represents ONE verified viewer + post + UTC day.
-- This is not a count of signed URL issuance, play-button taps or previews.
CREATE TABLE social.audio_post_listen_days (
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  viewer_account_id text NOT NULL,
  listen_day date NOT NULL,
  PRIMARY KEY (tenant_id, post_id, viewer_account_id, listen_day),
  FOREIGN KEY (tenant_id, post_id)
    REFERENCES social.audio_posts(tenant_id, post_id) ON DELETE CASCADE
);
-- The PK's (tenant_id, post_id) prefix supports count projections.
-- AF15/account-deletion operations must prune expired sessions and ensure
-- erasure/retention policy for identifying viewer/day rows. Do not expose
-- these tables via client-facing Data APIs or allow direct client writes.
