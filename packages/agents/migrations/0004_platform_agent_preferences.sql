CREATE TABLE agents.platform_agent_profiles (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  support_agent boolean NOT NULL DEFAULT false,
  voice_provider text NOT NULL CHECK (length(btrim(voice_provider)) BETWEEN 1 AND 80),
  voice_name text NOT NULL CHECK (length(btrim(voice_name)) BETWEEN 1 AND 120),
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  PRIMARY KEY (tenant_id, character_id)
);

CREATE INDEX platform_agent_support_idx
  ON agents.platform_agent_profiles(tenant_id, support_agent, character_id);

CREATE TABLE agents.user_agent_preferences (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  default_platform_character_id text NOT NULL,
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  PRIMARY KEY (tenant_id, user_id)
);
