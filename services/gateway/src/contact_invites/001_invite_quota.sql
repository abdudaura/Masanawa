-- U23 standalone migration; registration belongs to the single migration owner.
-- Never use demo bootstrap for production; requires sequenced migration apply.
CREATE TABLE IF NOT EXISTS masanawa_invite_daily_quota (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  utc_day DATE NOT NULL,
  uses INTEGER NOT NULL CHECK (uses BETWEEN 1 AND 100),
  PRIMARY KEY (tenant_id, user_id, utc_day)
);
CREATE INDEX IF NOT EXISTS masanawa_invite_daily_quota_expiry
  ON masanawa_invite_daily_quota (utc_day);
-- Purge quota records after documented 30-day retention approval.

