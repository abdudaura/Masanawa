-- U14 isolated migration PROPOSAL. F11/Work sequencer must assign the final migration
-- order and run this against disposable PostgreSQL before composing routes.
-- No automatic migration or production application from this file.
CREATE TABLE IF NOT EXISTS talks.host_preparations (
  prep_id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  host_user_id text NOT NULL,
  title varchar(160) NOT NULL CHECK (length(trim(title)) > 0),
  topic varchar(240) NOT NULL CHECK (length(trim(topic)) > 0),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(questions)='array' AND jsonb_array_length(questions) <= 8),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  phase text NOT NULL DEFAULT 'draft'
    CHECK (phase IN ('draft','publishing','published')),
  talk_id text UNIQUE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK ((phase='draft' AND talk_id IS NULL) OR (phase<>'draft' AND talk_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS host_preparations_owner_idx
  ON talks.host_preparations(tenant_id, host_user_id, updated_at DESC);
-- Publication uses deterministic talk_<prep_id>, canonical talks.talks PK/unique enforcement.
-- Never run automatic catch-up publication on records stuck in 'publishing'.
