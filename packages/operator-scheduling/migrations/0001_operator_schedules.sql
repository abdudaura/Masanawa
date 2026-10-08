-- U25 isolated, manually registered only by F11's migration authority.
-- Actor scopes are always supplied by the authenticated Gateway or trusted worker.
CREATE SCHEMA IF NOT EXISTS operator_scheduling;

CREATE TABLE operator_scheduling.schedules (
  schedule_id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  request_id text NOT NULL,
  payload_sha256 char(64) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('talk_reminder','lesson_followup','artifact_ready')),
  reference_id text NOT NULL CHECK (length(reference_id) BETWEEN 5 AND 160),
  frequency text NOT NULL CHECK (frequency IN ('once','daily','weekly')),
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 80),
  run_at timestamptz,
  local_time char(5),
  day_of_week integer CHECK (day_of_week BETWEEN 1 AND 7),
  quiet_start char(5) NOT NULL,
  quiet_end char(5) NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  sequence integer NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  next_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id,user_id,request_id),
  UNIQUE (tenant_id,user_id,schedule_id),
  CHECK ((frequency = 'once' AND run_at IS NOT NULL AND local_time IS NULL AND day_of_week IS NULL)
   OR (frequency = 'daily' AND run_at IS NULL AND local_time IS NOT NULL AND day_of_week IS NULL)
   OR (frequency = 'weekly' AND run_at IS NULL AND local_time IS NOT NULL AND day_of_week IS NOT NULL))
);
CREATE INDEX operator_schedules_due_idx ON operator_scheduling.schedules(next_due_at, schedule_id)
  WHERE state='active' AND next_due_at IS NOT NULL;
CREATE INDEX operator_schedules_owner_idx ON operator_scheduling.schedules
  (tenant_id,user_id,created_at DESC);

CREATE TABLE operator_scheduling.occurrences (
  occurrence_id uuid PRIMARY KEY,
  schedule_id uuid NOT NULL REFERENCES operator_scheduling.schedules(schedule_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  schedule_revision integer NOT NULL CHECK (schedule_revision > 0),
  scheduled_for timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('claimed','sending','sent','no_device','skipped','uncertain')),
  lease_token uuid NOT NULL,
  lease_until timestamptz,
  sending_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (schedule_id,sequence)
);
CREATE INDEX operator_occurrences_recovery_idx ON operator_scheduling.occurrences
  (state,lease_until) WHERE state='claimed';
CREATE INDEX operator_occurrences_uncertain_idx ON operator_scheduling.occurrences
  (sending_at) WHERE state='sending';
CREATE INDEX operator_occurrences_owner_idx ON operator_scheduling.occurrences
  (tenant_id,user_id,created_at DESC);
