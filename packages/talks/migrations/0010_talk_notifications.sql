CREATE TABLE IF NOT EXISTS talks.push_dedupe (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  dedupe_key text NOT NULL CHECK (length(btrim(dedupe_key)) BETWEEN 1 AND 512),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS talks_push_dedupe_created_idx
  ON talks.push_dedupe (created_at);
