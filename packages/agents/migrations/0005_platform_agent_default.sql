ALTER TABLE agents.platform_agent_profiles
  ADD COLUMN default_for_new_users boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX platform_agent_single_new_user_default
  ON agents.platform_agent_profiles(tenant_id)
  WHERE support_agent = true AND default_for_new_users = true;

ALTER TABLE agents.platform_agent_profiles
  ADD CONSTRAINT platform_agent_default_requires_support
  CHECK (NOT default_for_new_users OR support_agent);
