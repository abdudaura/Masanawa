CREATE TABLE skills.distribution (
  skill_version_id text PRIMARY KEY
    REFERENCES skills.versions(skill_version_id),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  CHECK (definition ->> 'skillVersionId' IS NOT DISTINCT FROM skill_version_id)
);

CREATE TRIGGER distribution_immutable
BEFORE UPDATE OR DELETE ON skills.distribution
FOR EACH ROW EXECUTE FUNCTION skills.reject_catalog_mutation();
