-- Mobile/user-app presentation for existing Characters.
-- Character identity remains in identity.*.
CREATE TABLE agents.agent_presentations (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  character_version_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  role_label text NOT NULL CHECK (length(trim(role_label)) BETWEEN 1 AND 120),
  about text NOT NULL DEFAULT '' CHECK (length(about) <= 500),
  greeting text CHECK (greeting IS NULL OR length(greeting) <= 1000),
  visible_in_user_app boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 1000000),
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  PRIMARY KEY (tenant_id, character_id)
);

CREATE INDEX agent_presentations_visible_idx
  ON agents.agent_presentations(
    tenant_id,
    visible_in_user_app,
    sort_order,
    character_id
  );

-- Independent exact SkillVersion selection for an existing Character.
-- Skill definition/readiness/certification remains in skills.*. These rows are
-- selection metadata only and never grant execution authority.
CREATE TABLE agents.character_skill_assignments (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  skill_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(skill_version_ids) = 'array'
      AND jsonb_array_length(skill_version_ids) <= 64
    ),
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision > 0 AND revision < 9007199254740991),
  PRIMARY KEY (tenant_id, character_id)
);
