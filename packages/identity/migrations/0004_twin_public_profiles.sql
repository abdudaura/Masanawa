CREATE TABLE identity.twin_public_profiles (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  owner_user_id text NOT NULL,
  public_id text NOT NULL
    CHECK (public_id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  display_name text NOT NULL
    CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  bio text NOT NULL DEFAULT ''
    CHECK (length(bio) <= 500),
  interests jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(interests) = 'array' AND jsonb_array_length(interests) <= 20),
  languages jsonb NOT NULL
    CHECK (jsonb_typeof(languages) = 'array'
      AND jsonb_array_length(languages) BETWEEN 1 AND 12),
  avatar_url text,
  discoverable boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1
    CHECK (revision BETWEEN 1 AND 9007199254740991),
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

CREATE INDEX twin_public_profiles_discovery_idx
  ON identity.twin_public_profiles(tenant_id, discoverable, updated_at DESC);

CREATE OR REPLACE FUNCTION identity.guard_twin_public_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM identity.character_ownership o
     WHERE o.tenant_id = NEW.tenant_id
       AND o.character_id = NEW.character_id
       AND o.kind = 'personal-clone'
       AND o.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Twin profile must bind canonical personal-clone ownership'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.character_id IS DISTINCT FROM OLD.character_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Twin profile stable identity/revision violation'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision <> 1 THEN
    RAISE EXCEPTION 'Twin profile initial revision must be 1'
      USING ERRCODE = '23514';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.languages) LOOP
    IF jsonb_typeof(item) <> 'string'
       OR length(btrim(item #>> '{}')) NOT BETWEEN 1 AND 40 THEN
      RAISE EXCEPTION 'Invalid Twin profile language'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.interests) LOOP
    IF jsonb_typeof(item) <> 'string'
       OR length(btrim(item #>> '{}')) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'Invalid Twin profile interest'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER twin_public_profile_guard
BEFORE INSERT OR UPDATE ON identity.twin_public_profiles
FOR EACH ROW EXECUTE FUNCTION identity.guard_twin_public_profile();

INSERT INTO identity.twin_public_profiles(
  tenant_id,
  character_id,
  owner_user_id,
  public_id,
  display_name,
  bio,
  interests,
  languages,
  avatar_url,
  discoverable,
  revision,
  created_at,
  updated_at
)
SELECT
  s.tenant_id,
  s.result->>'characterId',
  s.user_id,
  'twin_' || substr(md5(s.result->>'characterId'), 1, 20),
  left(btrim(s.profile->>'displayName'), 80),
  left(coalesce(s.profile->>'biography', ''), 500),
  (
    SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(s.profile->'expertise', '[]'::jsonb))
           WITH ORDINALITY AS interest(value, ordinality)
     WHERE ordinality <= 20
  ),
  (
    SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(s.profile->'languages')
           WITH ORDINALITY AS language(value, ordinality)
     WHERE ordinality <= 12
  ),
  NULL,
  false,
  1,
  s.created_at,
  s.updated_at
FROM identity.clone_setups s
JOIN identity.character_ownership o
  ON o.tenant_id = s.tenant_id
 AND o.character_id = s.result->>'characterId'
 AND o.owner_user_id = s.user_id
 AND o.kind = 'personal-clone'
WHERE s.state = 'ready'
  AND s.result IS NOT NULL
  AND s.profile->'displayName' <> 'null'::jsonb
  AND jsonb_array_length(s.profile->'languages') > 0
ON CONFLICT DO NOTHING;
