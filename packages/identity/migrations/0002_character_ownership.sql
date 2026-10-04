CREATE TABLE identity.character_ownership (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('platform', 'personal-clone', 'business')),
  owner_user_id text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, character_id),
  FOREIGN KEY (tenant_id, character_id)
    REFERENCES identity.characters(tenant_id, character_id),
  FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES identity.users(tenant_id, user_id),
  CHECK (
    (kind = 'platform' AND owner_user_id IS NULL)
    OR (kind = 'personal-clone' AND owner_user_id IS NOT NULL)
    OR kind = 'business'
  )
);

CREATE UNIQUE INDEX identity_one_personal_clone_per_user
  ON identity.character_ownership(tenant_id, owner_user_id)
  WHERE kind = 'personal-clone';
