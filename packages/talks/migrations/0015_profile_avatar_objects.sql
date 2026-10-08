-- Durable avatar object journal. Public profile identity stays in talks.public_profiles.
-- A failed upload, interrupted replacement, or crash must remain reclaimable.
CREATE TABLE IF NOT EXISTS talks.profile_avatar_objects (
  object_key text PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  public_url text NOT NULL,
  state text NOT NULL CHECK (state IN ('staged','active','orphaned','deleting')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT profile_avatar_key_prefix CHECK (object_key LIKE 'profiles/%')
);
CREATE INDEX IF NOT EXISTS profile_avatar_objects_gc_idx
  ON talks.profile_avatar_objects (state, updated_at)
  WHERE state IN ('staged','orphaned','deleting');
CREATE INDEX IF NOT EXISTS profile_avatar_objects_owner_idx
  ON talks.profile_avatar_objects (tenant_id,user_id,state);
