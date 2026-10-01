CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.tenants (
  tenant_id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'disabled', 'archived')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE identity.users (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'disabled', 'archived')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(tenant_id)
);

CREATE TABLE identity.external_user_identities (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  system text NOT NULL CHECK (length(btrim(system)) BETWEEN 1 AND 128),
  namespace text NOT NULL CHECK (length(btrim(namespace)) BETWEEN 1 AND 128),
  account_id text,
  subject_value text NOT NULL CHECK (length(btrim(subject_value)) BETWEEN 1 AND 2048),
  authentication_strength text NOT NULL
    CHECK (authentication_strength IN ('linked', 'strong')),
  observed_at timestamptz NOT NULL,
  expires_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provenance) = 'object'),
  linked_at timestamptz NOT NULL,
  CHECK (expires_at IS NULL OR expires_at > observed_at),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, system, namespace, account_id, subject_value
  )
);

CREATE INDEX external_user_identities_user_idx
  ON identity.external_user_identities(tenant_id, user_id);

CREATE TABLE identity.characters (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'disabled', 'archived')),
  active_character_version_id text,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, character_id),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(tenant_id)
);

CREATE TABLE identity.character_versions (
  tenant_id text NOT NULL,
  character_version_id text NOT NULL,
  character_id text NOT NULL,
  version_number bigint NOT NULL CHECK (version_number > 0),
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'published', 'retired')),
  constitution jsonb NOT NULL CHECK (jsonb_typeof(constitution) = 'object'),
  created_at timestamptz NOT NULL,
  published_at timestamptz,
  retired_at timestamptz,
  PRIMARY KEY (tenant_id, character_version_id),
  UNIQUE (tenant_id, character_id, version_number),
  UNIQUE (tenant_id, character_version_id, character_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  CHECK (
    (state = 'draft' AND published_at IS NULL AND retired_at IS NULL)
    OR (state = 'published' AND published_at IS NOT NULL AND retired_at IS NULL)
    OR (state = 'retired' AND published_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

ALTER TABLE identity.characters
  ADD CONSTRAINT characters_active_version_fk
  FOREIGN KEY (tenant_id, active_character_version_id, character_id)
  REFERENCES identity.character_versions(
    tenant_id, character_version_id, character_id
  );

CREATE OR REPLACE FUNCTION identity.reject_character_version_content_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.character_version_id IS DISTINCT FROM OLD.character_version_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.constitution IS DISTINCT FROM OLD.constitution
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CharacterVersion content is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER character_versions_immutable_content
BEFORE UPDATE ON identity.character_versions
FOR EACH ROW
EXECUTE FUNCTION identity.reject_character_version_content_update();

CREATE TABLE identity.relationships (
  tenant_id text NOT NULL,
  relationship_id text NOT NULL,
  user_id text NOT NULL,
  character_id text NOT NULL,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'archived')),
  stage text,
  tone text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferences) = 'object'),
  disclosures jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(disclosures) = 'object'),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(permissions) = 'object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, relationship_id),
  UNIQUE (tenant_id, user_id, character_id),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES identity.users(tenant_id, user_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id)
);

CREATE INDEX relationships_character_idx
  ON identity.relationships(tenant_id, character_id);
