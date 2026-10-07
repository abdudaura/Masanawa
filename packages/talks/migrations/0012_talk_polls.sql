CREATE TABLE IF NOT EXISTS talks.polls (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  poll_id text NOT NULL,
  question text NOT NULL CHECK (length(btrim(question)) BETWEEN 1 AND 240),
  options_json jsonb NOT NULL
    CHECK (
      jsonb_typeof(options_json) = 'array'
      AND jsonb_array_length(options_json) BETWEEN 2 AND 4
    ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL,
  closed_at timestamptz NULL,
  PRIMARY KEY (tenant_id, talk_id, poll_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS talks_polls_one_open_idx
  ON talks.polls (tenant_id, talk_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS talks.poll_votes (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  poll_id text NOT NULL,
  user_id text NOT NULL,
  option_id text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, talk_id, poll_id, user_id),
  FOREIGN KEY (tenant_id, talk_id, poll_id)
    REFERENCES talks.polls(tenant_id, talk_id, poll_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS talks_poll_votes_counts_idx
  ON talks.poll_votes (tenant_id, talk_id, poll_id, option_id);
