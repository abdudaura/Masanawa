CREATE TABLE IF NOT EXISTS talks.push_dedupe (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  dedupe_key text NOT NULL CHECK (length(dedupe_key) BETWEEN 1 AND 600),
  claimed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, dedupe_key),
  CHECK (expires_at > claimed_at)
);

CREATE INDEX IF NOT EXISTS talks_push_dedupe_expiry_idx
  ON talks.push_dedupe (expires_at);
