CREATE TABLE IF NOT EXISTS talks.saved_talks (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  talk_id text NOT NULL,
  saved_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, talk_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS talks_saved_talks_user_idx
  ON talks.saved_talks (tenant_id, user_id, saved_at DESC);
