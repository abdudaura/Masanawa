-- U16 proposal ONLY. Single database migration owner must allocate a unique
-- version and register it in the PG18 production schema manifest after review.
-- Do not apply via Alpha bootstrap or to the production database from this PR.
CREATE TABLE IF NOT EXISTS talks.post_session_insights (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  recording_id text NOT NULL,
  host_user_id text NOT NULL,
  media_checksum text NOT NULL CHECK (media_checksum ~ '^[a-fA-F0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('processing','ready','failed')),
  lease_token text,
  lease_until timestamptz,
  consented_at timestamptz NOT NULL,
  summary text CHECK (length(summary) <= 2400),
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(highlights)='array' AND jsonb_array_length(highlights) <= 6),
  next_talk_title text CHECK (length(next_talk_title) <= 120),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,talk_id),
  CHECK ((status='processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (status<>'processing' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS post_session_insights_lease_idx
  ON talks.post_session_insights(status,lease_until)
  WHERE status='processing';
CREATE INDEX IF NOT EXISTS post_session_insights_retention_idx
  ON talks.post_session_insights(consented_at);
-- Integrator: arrange retention/deletion with R12, R13 and account/talk erasure.
-- A 30-day response filter alone does NOT physically delete private text.
