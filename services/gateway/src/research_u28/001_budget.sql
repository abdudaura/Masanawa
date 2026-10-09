-- U28 additive migration; must be registered once by the central schema owner.
-- Request quotas are not Credits or provider transactions. No unverified deployment.
CREATE SCHEMA IF NOT EXISTS research_u28;
CREATE TABLE IF NOT EXISTS research_u28.daily_budget (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  budget_day date NOT NULL,
  used_units integer NOT NULL DEFAULT 0 CHECK (used_units >= 0),
  PRIMARY KEY (tenant_id, user_id, budget_day)
);
CREATE TABLE IF NOT EXISTS research_u28.reservations (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  request_id uuid NOT NULL,
  budget_day date NOT NULL,
  units integer NOT NULL CHECK (units > 0),
  status text NOT NULL CHECK (status IN ('reserved', 'charged', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, request_id),
  FOREIGN KEY (tenant_id, user_id, budget_day)
    REFERENCES research_u28.daily_budget (tenant_id, user_id, budget_day)
);
CREATE INDEX IF NOT EXISTS research_u28_reservations_by_created
 ON research_u28.reservations (created_at);
-- R12 account deletion owner must purge rows by (tenant_id,user_id).
-- Daily quota prune only after old reservations are purged (FK requires ordering).

