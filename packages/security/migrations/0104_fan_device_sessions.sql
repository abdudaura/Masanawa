-- C09: stable opaque device handle on the existing canonical auth session.
-- No second session authority, credential copy, deletion or financial modification.
-- AF00: rehearse lock duration and upgrade against restored staging before activation.
ALTER TABLE security.platform_sessions
  ADD COLUMN IF NOT EXISTS device_id uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS platform_sessions_device_id_uq
  ON security.platform_sessions(device_id);
CREATE INDEX IF NOT EXISTS platform_sessions_device_owner_idx
  ON security.platform_sessions(tenant_id,user_id,created_at DESC)
  WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS security.fan_session_revocation_audit (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  device_id uuid NOT NULL,
  request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,fan_user_id,request_key),
  FOREIGN KEY(tenant_id,fan_user_id)
    REFERENCES security.platform_user_profiles(tenant_id,user_id)
);
