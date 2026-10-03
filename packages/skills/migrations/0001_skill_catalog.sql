CREATE SCHEMA IF NOT EXISTS skills;

-- The platform catalog follows the canonical SkillId <-> key identity. It is
-- not a tenant grant, workflow checkpoint, or Provider execution store.
CREATE TABLE skills.skills (
  skill_id text PRIMARY KEY CHECK (skill_id ~ '^skill_'),
  key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (skill_id, key)
);

CREATE TABLE skills.versions (
  skill_version_id text PRIMARY KEY CHECK (skill_version_id ~ '^skill-version_'),
  skill_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  definition jsonb NOT NULL,
  definition_hash text NOT NULL CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY (skill_id, key) REFERENCES skills.skills (skill_id, key),
  UNIQUE (key, version),
  CHECK (jsonb_typeof(definition) = 'object'),
  CHECK (definition ->> 'skillVersionId' IS NOT DISTINCT FROM skill_version_id),
  CHECK (definition ->> 'skillId' IS NOT DISTINCT FROM skill_id),
  CHECK (definition ->> 'key' IS NOT DISTINCT FROM key),
  CHECK (definition ->> 'version' IS NOT DISTINCT FROM version),
  CHECK (jsonb_typeof(definition -> 'dependencies') IS NOT DISTINCT FROM 'array'),
  CHECK (jsonb_array_length(definition -> 'dependencies') <= 64)
);

CREATE FUNCTION skills.reject_catalog_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Canonical Skill identities and versions are immutable'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER skills_immutable BEFORE UPDATE OR DELETE ON skills.skills
  FOR EACH ROW EXECUTE FUNCTION skills.reject_catalog_mutation();
CREATE TRIGGER versions_immutable BEFORE UPDATE OR DELETE ON skills.versions
  FOR EACH ROW EXECUTE FUNCTION skills.reject_catalog_mutation();

CREATE FUNCTION skills.validate_dependencies() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.definition -> 'dependencies') d
    WHERE jsonb_typeof(d) <> 'string'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.definition -> 'dependencies') d(id)
    LEFT JOIN skills.versions v ON v.skill_version_id = d.id
    WHERE v.skill_version_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Skill dependency is missing or invalid' USING ERRCODE = '23514';
  END IF;
  -- UNION removes duplicate reachability states; diamonds do not enumerate paths.
  IF EXISTS (
    WITH RECURSIVE reachable(id) AS (
      SELECT jsonb_array_elements_text(NEW.definition -> 'dependencies')
      UNION
      SELECT jsonb_array_elements_text(v.definition -> 'dependencies')
      FROM reachable r JOIN skills.versions v ON v.skill_version_id = r.id
    ) SELECT 1 FROM reachable WHERE id = NEW.skill_version_id
  ) THEN
    RAISE EXCEPTION 'Skill dependency cycle' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    WITH RECURSIVE depths(id, depth) AS (
      SELECT NEW.skill_version_id, 1
      UNION
      SELECT d.id, r.depth + 1 FROM depths r
      JOIN skills.versions v ON v.skill_version_id = r.id
      CROSS JOIN LATERAL jsonb_array_elements_text(v.definition -> 'dependencies') d(id)
      WHERE r.depth < 17
    ) SELECT 1 FROM depths WHERE depth > 16
  ) THEN
    RAISE EXCEPTION 'Skill dependency depth exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
-- Complete dependency batches may arrive in either order within one transaction.
CREATE CONSTRAINT TRIGGER versions_dependencies AFTER INSERT ON skills.versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION skills.validate_dependencies();

CREATE TABLE skills.readiness (
  skill_version_id text PRIMARY KEY REFERENCES skills.versions (skill_version_id),
  state text NOT NULL CHECK (state IN ('ready', 'degraded', 'blocked', 'disabled')),
  advertised boolean NOT NULL CHECK (NOT advertised OR state = 'ready'),
  reason_code text,
  checked_at timestamptz NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991)
);

CREATE FUNCTION skills.validate_readiness() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.revision <> 1 THEN
    RAISE EXCEPTION 'First readiness revision must be one' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.skill_version_id <> OLD.skill_version_id OR
    NEW.revision <> OLD.revision + 1 OR NEW.checked_at < OLD.checked_at
  ) THEN
    RAISE EXCEPTION 'Readiness observation is stale or revision is invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.advertised AND EXISTS (
    SELECT 1 FROM skills.versions WHERE skill_version_id = NEW.skill_version_id
    AND definition ->> 'visibility' <> 'model-visible'
  ) THEN
    RAISE EXCEPTION 'Hidden Skill cannot advertise' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER readiness_valid BEFORE INSERT OR UPDATE ON skills.readiness
  FOR EACH ROW EXECUTE FUNCTION skills.validate_readiness();
CREATE TRIGGER readiness_no_delete BEFORE DELETE ON skills.readiness
  FOR EACH ROW EXECUTE FUNCTION skills.reject_catalog_mutation();
