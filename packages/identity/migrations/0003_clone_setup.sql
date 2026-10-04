CREATE TABLE identity.clone_setups (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  state text NOT NULL CHECK (state IN ('editing','preview','confirmed','ready','cancelled')),
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  confirmation_request_id text CHECK (confirmation_request_id ~ '^request_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'),
  confirmation_preview_revision bigint,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES identity.users(tenant_id, user_id),
  CHECK ((state IN ('confirmed','ready') AND confirmation_request_id IS NOT NULL
          AND confirmation_preview_revision IS NOT NULL
          AND confirmation_preview_revision > 0 AND confirmation_preview_revision < revision)
      OR (state NOT IN ('confirmed','ready') AND confirmation_request_id IS NULL AND confirmation_preview_revision IS NULL)),
  CHECK ((state = 'ready' AND result IS NOT NULL AND jsonb_typeof(result) = 'object')
      OR (state <> 'ready' AND result IS NULL))
);

CREATE FUNCTION identity.guard_clone_setup() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE field_name text; item jsonb; maximum integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state IN ('confirmed','ready') THEN
      RAISE EXCEPTION 'Confirmed clone setup is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.revision <> OLD.revision + 1
       OR OLD.state = 'ready' THEN
      RAISE EXCEPTION 'Invalid clone setup revision' USING ERRCODE = '23514';
    END IF;
    IF OLD.state = 'confirmed' AND (NEW.state <> 'ready' OR NEW.profile IS DISTINCT FROM OLD.profile
        OR NEW.confirmation_request_id IS DISTINCT FROM OLD.confirmation_request_id
        OR NEW.confirmation_preview_revision IS DISTINCT FROM OLD.confirmation_preview_revision) THEN
      RAISE EXCEPTION 'Confirmed clone profile is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.state = 'confirmed' AND (OLD.state <> 'preview' OR NEW.profile IS DISTINCT FROM OLD.profile
        OR NEW.confirmation_preview_revision <> OLD.revision) THEN
      RAISE EXCEPTION 'Confirmation requires exact preview' USING ERRCODE = '23514';
    END IF;
    IF NEW.state = 'ready' AND OLD.state <> 'confirmed' THEN
      RAISE EXCEPTION 'Completion requires confirmation' USING ERRCODE = '23514';
    END IF;
    IF NEW.state = 'preview' AND (OLD.state <> 'editing' OR NEW.profile IS DISTINCT FROM OLD.profile)
       OR NEW.state = 'editing' AND OLD.state NOT IN ('editing','preview','cancelled')
       OR NEW.state = 'cancelled' AND OLD.state NOT IN ('editing','preview') THEN
      RAISE EXCEPTION 'Invalid clone setup transition' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.state NOT IN ('editing','cancelled') OR NEW.revision <> 1 THEN
    RAISE EXCEPTION 'Invalid initial clone setup' USING ERRCODE = '23514';
  END IF;
  IF NOT (NEW.profile ?& ARRAY['displayName','biography','languages','personality','expertise'])
     OR NEW.profile - ARRAY['displayName','biography','languages','personality','expertise'] <> '{}'::jsonb
     OR jsonb_typeof(NEW.profile->'biography') <> 'string'
     OR length(btrim(NEW.profile->>'biography')) NOT BETWEEN 1 AND 1000
     OR (NEW.profile->'displayName' <> 'null'::jsonb AND
         (jsonb_typeof(NEW.profile->'displayName') <> 'string' OR length(btrim(NEW.profile->>'displayName')) NOT BETWEEN 1 AND 120)) THEN
    RAISE EXCEPTION 'Invalid clone profile' USING ERRCODE = '23514';
  END IF;
  FOREACH field_name IN ARRAY ARRAY['languages','personality','expertise'] LOOP
    maximum := CASE field_name WHEN 'languages' THEN 16 WHEN 'personality' THEN 24 ELSE 32 END;
    IF jsonb_typeof(NEW.profile->field_name) <> 'array' THEN
      RAISE EXCEPTION 'Invalid clone profile list' USING ERRCODE = '23514';
    END IF;
    IF jsonb_array_length(NEW.profile->field_name) > maximum
       OR (field_name <> 'languages' AND jsonb_array_length(NEW.profile->field_name) = 0) THEN
      RAISE EXCEPTION 'Invalid clone profile list length' USING ERRCODE = '23514';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.profile->field_name) LOOP
      IF jsonb_typeof(item) <> 'string' OR length(btrim(item #>> '{}')) NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Invalid clone profile list item' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.profile->field_name) value
               GROUP BY lower(btrim(value)) HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'Duplicate clone profile item' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF NEW.state IN ('preview','confirmed','ready') AND
      (NEW.profile->'displayName' = 'null'::jsonb OR jsonb_array_length(NEW.profile->'languages') = 0) THEN
    RAISE EXCEPTION 'Clone preview is incomplete' USING ERRCODE = '23514';
  END IF;
  IF NEW.state = 'ready' AND (
     NOT (NEW.result ?& ARRAY['characterId','characterVersionId','relationshipId','displayName','created'])
     OR NEW.result - ARRAY['characterId','characterVersionId','relationshipId','displayName','created'] <> '{}'::jsonb
     OR jsonb_typeof(NEW.result->'created') <> 'boolean') THEN
    RAISE EXCEPTION 'Invalid clone result' USING ERRCODE = '23514';
  END IF;
  IF NEW.state = 'ready' AND NOT EXISTS (
      SELECT 1 FROM identity.character_ownership o
      JOIN identity.characters c ON c.tenant_id=o.tenant_id AND c.character_id=o.character_id
      JOIN identity.character_versions v ON v.tenant_id=c.tenant_id AND v.character_id=c.character_id
      JOIN identity.relationships r ON r.tenant_id=o.tenant_id AND r.character_id=o.character_id AND r.user_id=o.owner_user_id
      WHERE o.tenant_id=NEW.tenant_id AND o.owner_user_id=NEW.user_id AND o.kind='personal-clone'
        AND c.character_id=NEW.result->>'characterId' AND c.state='active'
        AND v.character_version_id=NEW.result->>'characterVersionId' AND v.state='published'
        AND c.active_character_version_id=v.character_version_id
        AND v.constitution->>'displayName'=NEW.result->>'displayName'
        AND r.relationship_id=NEW.result->>'relationshipId' AND r.state='active'
  ) THEN
    RAISE EXCEPTION 'Clone result must bind canonical owner identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clone_setup_guard BEFORE INSERT OR UPDATE OR DELETE ON identity.clone_setups
FOR EACH ROW EXECUTE FUNCTION identity.guard_clone_setup();
