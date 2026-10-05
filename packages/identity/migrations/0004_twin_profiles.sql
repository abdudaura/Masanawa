CREATE TABLE identity.twin_profiles (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  owner_user_id text NOT NULL,
  public_id text NOT NULL CHECK (public_id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 500),
  interests jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interests) = 'array'),
  languages jsonb NOT NULL CHECK (jsonb_typeof(languages) = 'array' AND jsonb_array_length(languages) > 0),
  avatar_url text,
  discoverable boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, character_id),
  UNIQUE (tenant_id, owner_user_id),
  UNIQUE (tenant_id, public_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES identity.users(tenant_id, user_id),
  CHECK (avatar_url IS NULL OR avatar_url ~ '^https://')
);

CREATE INDEX identity_twin_profiles_discovery_idx
  ON identity.twin_profiles(tenant_id, discoverable, updated_at DESC, public_id)
  WHERE discoverable = true;

CREATE OR REPLACE FUNCTION identity.guard_twin_profile()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Twin profile identity is durable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.character_id IS DISTINCT FROM OLD.character_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.revision <> OLD.revision + 1
       OR NEW.updated_at <= OLD.updated_at THEN
      RAISE EXCEPTION 'Invalid Twin profile revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM identity.character_ownership o
     WHERE o.tenant_id = NEW.tenant_id
       AND o.character_id = NEW.character_id
       AND o.owner_user_id = NEW.owner_user_id
       AND o.kind = 'personal-clone'
  ) THEN
    RAISE EXCEPTION 'Twin profile must bind canonical personal-clone ownership'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER twin_profile_guard
BEFORE INSERT OR UPDATE OR DELETE ON identity.twin_profiles
FOR EACH ROW EXECUTE FUNCTION identity.guard_twin_profile();
