CREATE TABLE security.credential_refs (
  credential_ref_id text PRIMARY KEY CHECK (
    credential_ref_id ~ '^credential-ref_'
  ),
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  provider_id text NOT NULL CHECK (provider_id ~ '^provider_'),
  slot_key text NOT NULL CHECK (
    length(btrim(slot_key)) > 0 AND length(slot_key) <= 128
  ),
  purpose text NOT NULL CHECK (
    length(btrim(purpose)) > 0 AND length(purpose) <= 200
  ),
  destination_key text NOT NULL CHECK (
    length(btrim(destination_key)) > 0
    AND length(destination_key) <= 200
  ),
  vault_locator text NOT NULL CHECK (
    length(btrim(vault_locator)) > 0
    AND length(vault_locator) <= 1000
  ),
  generation integer NOT NULL CHECK (generation > 0),
  state text NOT NULL CHECK (state IN ('active', 'revoked')),
  created_at timestamptz NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (state = 'active' AND revoked_at IS NULL)
    OR
    (state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX credential_refs_scope_idx
  ON security.credential_refs (
    tenant_id,
    provider_id,
    slot_key,
    purpose,
    destination_key,
    state
  );

CREATE OR REPLACE FUNCTION security.prevent_credential_ref_rebinding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id
     OR NEW.provider_id <> OLD.provider_id
     OR NEW.slot_key <> OLD.slot_key
     OR NEW.purpose <> OLD.purpose
     OR NEW.destination_key <> OLD.destination_key
     OR NEW.vault_locator <> OLD.vault_locator
     OR NEW.generation <> OLD.generation
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'credential ref binding is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER credential_refs_immutable_binding
BEFORE UPDATE ON security.credential_refs
FOR EACH ROW
EXECUTE FUNCTION security.prevent_credential_ref_rebinding();

COMMENT ON TABLE security.credential_refs IS
  'Non-secret immutable CredentialRef binding metadata. Secret values remain in approved vault storage; revocation is the only lifecycle mutation.';
