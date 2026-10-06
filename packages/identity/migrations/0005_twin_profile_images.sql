CREATE TABLE identity.twin_profile_images (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  owner_user_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  image_bytes bytea NOT NULL CHECK (octet_length(image_bytes) BETWEEN 1 AND 4194304),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, character_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES identity.users(tenant_id, user_id)
);

CREATE OR REPLACE FUNCTION identity.guard_twin_profile_image()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM identity.character_ownership o
     WHERE o.tenant_id = NEW.tenant_id
       AND o.character_id = NEW.character_id
       AND o.owner_user_id = NEW.owner_user_id
       AND o.kind = 'personal-clone'
  ) THEN
    RAISE EXCEPTION 'Twin image must bind canonical personal-clone ownership'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER twin_profile_image_guard
BEFORE INSERT OR UPDATE ON identity.twin_profile_images
FOR EACH ROW EXECUTE FUNCTION identity.guard_twin_profile_image();
