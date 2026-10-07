CREATE TABLE IF NOT EXISTS talks.questions (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  question_id text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','answered','dismissed')),
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, talk_id, question_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS talk_questions_pending_host_idx
  ON talks.questions(tenant_id, talk_id, status, created_at, question_id);

CREATE INDEX IF NOT EXISTS talk_questions_pending_author_idx
  ON talks.questions(tenant_id, talk_id, author_user_id, status, created_at);
