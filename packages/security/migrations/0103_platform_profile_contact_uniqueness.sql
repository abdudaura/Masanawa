-- Email-only and SMS-only customers may coexist within the same tenant.
-- Historical 0100 used NULLS NOT DISTINCT, which limited each tenant to one
-- absent phone and one absent email, breaking ordinary customer onboarding.
-- Keep uniqueness for actual non-null identifiers and all existing FKs.
ALTER TABLE security.platform_user_profiles
  DROP CONSTRAINT platform_user_profiles_tenant_id_email_key,
  DROP CONSTRAINT platform_user_profiles_tenant_id_phone_key,
  ADD CONSTRAINT platform_user_profiles_tenant_id_email_key UNIQUE (tenant_id, email),
  ADD CONSTRAINT platform_user_profiles_tenant_id_phone_key UNIQUE (tenant_id, phone);
