-- Email-only and SMS-only users must coexist within one tenant.
-- 0100 erroneously used NULLS NOT DISTINCT for both optional contacts:
-- the second email-only user collided on (tenant_id, NULL phone), and
-- the second SMS-only user collided on (tenant_id, NULL email).
-- Preserve uniqueness of actual, non-null contact values, without modifying
-- existing rows or identity bindings. Applied atomically by runMigrations.
ALTER TABLE security.platform_user_profiles
  DROP CONSTRAINT platform_user_profiles_tenant_id_email_key,
  DROP CONSTRAINT platform_user_profiles_tenant_id_phone_key;

CREATE UNIQUE INDEX platform_user_profiles_tenant_email_present_key
  ON security.platform_user_profiles (tenant_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX platform_user_profiles_tenant_phone_present_key
  ON security.platform_user_profiles (tenant_id, phone)
  WHERE phone IS NOT NULL;
