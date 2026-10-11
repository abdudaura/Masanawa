-- 6-digit device password auth (U-auth-pw). Phone login without SMS OTP;
-- email keeps OTP. Passwords are peppered HMAC-SHA256 hashes (6-digit
-- domain, attempt-limited like OTP challenges); devices are explicit
-- bindings so a password is only asked on unknown devices.

CREATE TABLE security.platform_device_passwords (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  password_hash text NOT NULL CHECK (password_hash ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  locked_until timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id) REFERENCES security.platform_user_profiles(tenant_id,user_id)
);

CREATE TABLE security.platform_auth_devices (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  device_id text NOT NULL CHECK (device_id ~ '^[0-9a-f]{32}$'),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,device_id),
  FOREIGN KEY (tenant_id,user_id) REFERENCES security.platform_user_profiles(tenant_id,user_id)
);
CREATE INDEX platform_auth_devices_user_idx ON security.platform_auth_devices(tenant_id,user_id,last_seen_at DESC);
