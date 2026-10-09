-- U08 additive, unregistered migration. Migration owner MUST elect correct
-- migration order after C01/C02, review against main, and apply in disposable DB
-- before registering U08 routes. No model-generated DM data is retained here.
CREATE TABLE IF NOT EXISTS talks.human_ai_assist_quota (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  usage_count INTEGER NOT NULL CHECK (usage_count BETWEEN 1 AND 20),
  PRIMARY KEY (tenant_id,user_id,window_start),
  FOREIGN KEY (tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS human_ai_assist_quota_expiry
  ON talks.human_ai_assist_quota(window_start);
-- Scheduled owner cleanup: DELETE FROM talks.human_ai_assist_quota
-- WHERE window_start < clock_timestamp() - interval '48 hours';
-- Do not register the cleanup on another worker without lease.
