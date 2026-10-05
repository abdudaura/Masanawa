CREATE TABLE security.platform_otp_challenges (
  tenant_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  identifier text NOT NULL CHECK (length(identifier) BETWEEN 3 AND 320),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  resend_after timestamptz NOT NULL,
  consumed_at timestamptz,
  PRIMARY KEY (tenant_id,channel,identifier),
  CHECK (expires_at > created_at),
  CHECK (resend_after > created_at)
);

CREATE TABLE security.platform_user_profiles (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  email text,
  phone text,
  locale text NOT NULL DEFAULT 'ng' CHECK (length(locale) BETWEEN 2 AND 16),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id),
  UNIQUE NULLS NOT DISTINCT (tenant_id,email),
  UNIQUE NULLS NOT DISTINCT (tenant_id,phone),
  -- Identity is a later migration owner in the composed financial graph.
  -- Runtime onboarding creates the canonical identity.users row first in the
  -- same transaction; this migration must not make Security depend on a schema
  -- that does not exist yet.
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE security.platform_sessions (
  access_hash text PRIMARY KEY CHECK (access_hash ~ '^[0-9a-f]{64}$'),
  refresh_hash text NOT NULL UNIQUE CHECK (refresh_hash ~ '^[0-9a-f]{64}$'),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id,user_id) REFERENCES security.platform_user_profiles(tenant_id,user_id),
  CHECK (refresh_expires_at > access_expires_at),
  CHECK (access_expires_at > created_at)
);
CREATE INDEX platform_sessions_user_idx ON security.platform_sessions(tenant_id,user_id,created_at DESC);
