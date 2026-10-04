CREATE TABLE skills.guides (
  skill_version_id text PRIMARY KEY
    REFERENCES skills.versions(skill_version_id),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (definition ->> 'skillVersionId' IS NOT DISTINCT FROM skill_version_id),
  CHECK (definition ->> 'contentHash' IS NOT DISTINCT FROM content_hash)
);

CREATE TRIGGER guides_immutable
BEFORE UPDATE OR DELETE ON skills.guides
FOR EACH ROW EXECUTE FUNCTION skills.reject_catalog_mutation();
