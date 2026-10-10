-- L-MISSIONS J12: feature-owned, forward-only. AF00 registers AFTER identity and masana/0001.
-- Does not migrate or delete any legacy data. No worker/provider enabled by this SQL alone.
CREATE SCHEMA IF NOT EXISTS masana;
CREATE TABLE masana.missions (
  tenant_id text NOT NULL,
  mission_id text NOT NULL CHECK (mission_id ~ '^mission_'),
  character_id text NOT NULL,
  week_start date NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  objective text NOT NULL CHECK (length(btrim(objective)) BETWEEN 8 AND 600),
  topic_focus text NOT NULL CHECK (length(btrim(topic_focus)) BETWEEN 2 AND 140),
  autonomy_level smallint NOT NULL DEFAULT 1 CHECK (autonomy_level BETWEEN 0 AND 2),
  budget_minor bigint NOT NULL CHECK (budget_minor >= 0),
  spent_minor bigint NOT NULL DEFAULT 0 CHECK (spent_minor >= 0 AND spent_minor <= budget_minor),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','paused','archived')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,mission_id),
  UNIQUE (tenant_id,character_id,week_start),
  FOREIGN KEY (tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES identity.users(tenant_id,user_id)
);
CREATE INDEX missions_staff_week ON masana.missions(tenant_id,week_start DESC,character_id);
CREATE TABLE masana.posting_slots (
  tenant_id text NOT NULL,
  slot_id text NOT NULL CHECK (slot_id ~ '^slot_'),
  mission_id text NOT NULL,
  character_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','image','audio')),
  scheduled_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  topic text NOT NULL CHECK (length(btrim(topic)) BETWEEN 2 AND 140),
  draft_body text NOT NULL CHECK (length(btrim(draft_body)) BETWEEN 1 AND 6000),
  estimated_cost_minor bigint NOT NULL CHECK (estimated_cost_minor >= 0),
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','approved','publishing','published','failed','cancelled')),
  approved_by text,
  approved_at timestamptz,
  publication_key text NOT NULL,
  post_id text,
  published_at timestamptz,
  lease_token text,
  lease_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,slot_id),
  UNIQUE (tenant_id,publication_key),
  FOREIGN KEY (tenant_id,mission_id) REFERENCES masana.missions(tenant_id,mission_id),
  FOREIGN KEY (tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id),
  FOREIGN KEY (tenant_id,approved_by) REFERENCES identity.users(tenant_id,user_id),
  CHECK (state <> 'published' OR (post_id IS NOT NULL AND published_at IS NOT NULL)),
  CHECK (state <> 'publishing' OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX posting_slots_due ON masana.posting_slots(state,next_retry_at,scheduled_at)
  WHERE state IN ('approved','publishing');
CREATE INDEX posting_slots_mission ON masana.posting_slots(tenant_id,mission_id,scheduled_at);
CREATE TABLE masana.mission_runs (
  tenant_id text NOT NULL,
  run_id text NOT NULL,
  slot_id text NOT NULL,
  publication_key text NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  status text NOT NULL CHECK (status IN ('leased','published','retry','exhausted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  failure_code text,
  PRIMARY KEY (tenant_id,run_id),
  UNIQUE (tenant_id,slot_id,attempt),
  FOREIGN KEY (tenant_id,slot_id) REFERENCES masana.posting_slots(tenant_id,slot_id)
);
-- Historical runs and accepted budget costs are preserved. Never delete live journal/financial history.
