-- J13 appeal retries. Forward-only: historical rows remain valid with NULL keys.
-- New writer requires a scoped, non-empty request key; uniqueness is enforced in PG.
ALTER TABLE moderation.appeals
 ADD COLUMN IF NOT EXISTS client_request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS moderation_appeal_request_once
 ON moderation.appeals(tenant_id,case_id,appellant_user_id,client_request_id)
 WHERE client_request_id IS NOT NULL;
