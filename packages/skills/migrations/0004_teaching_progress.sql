CREATE TABLE skills.teaching_progress (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  relationship_id text NOT NULL,
  topic text NOT NULL CHECK (length(btrim(topic)) BETWEEN 1 AND 240),
  goal text NOT NULL CHECK (length(btrim(goal)) BETWEEN 1 AND 500),
  learner_level text NOT NULL CHECK (length(btrim(learner_level)) BETWEEN 1 AND 120),
  checkpoint text NOT NULL CHECK (length(btrim(checkpoint)) BETWEEN 1 AND 1000),
  next_step text NOT NULL CHECK (length(btrim(next_step)) BETWEEN 1 AND 1000),
  mastery_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,character_id,relationship_id),
  CHECK (jsonb_typeof(mastery_notes) = 'array')
);

CREATE INDEX teaching_progress_user_idx
  ON skills.teaching_progress(tenant_id,user_id,updated_at DESC);
