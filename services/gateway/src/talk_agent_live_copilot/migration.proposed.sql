-- U15 PROPOSED migration, NOT REGISTERED. F04/central DB integrator must assign
-- final ordered filename after checking existing migrations and C/R PR heads.
-- No money, personal messages, raw transcripts or AI model outputs are stored.
CREATE TABLE IF NOT EXISTS talks.live_copilot_turns (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  seat_id text NOT NULL,
  host_user_id text NOT NULL,
  request_id text NOT NULL,
  transcript_hash char(64) NOT NULL,
  state text NOT NULL CHECK(state IN ('running','published','denied','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, host_user_id, request_id)
);
CREATE INDEX IF NOT EXISTS live_copilot_turns_budget_idx
  ON talks.live_copilot_turns (tenant_id, talk_id, host_user_id, created_at DESC);
-- Purge only under approved retention, and reconcile 'running'/'unknown'
-- manually with the R02 publishing system; NEVER reset these to retry.
