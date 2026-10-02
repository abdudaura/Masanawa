CREATE TABLE security.credential_refs (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_'),
  credential_ref_id text NOT NULL CHECK (credential_ref_id ~ '^credential-ref_'),
  provider_id text NOT NULL CHECK (provider_id ~ '^provider_'),
  slot_key text NOT NULL CHECK (
    length(btrim(slot_key)) > 0
    AND length(slot_key) <= 128
  ),
  generation integer NOT NULL CHECK (generation > 0),
  algorithm text NOT NULL CHECK (
    length(btrim(algorithm)) > 0
    AND length(algorithm) <= 128
  ),
  key_id text NOT NULL CHECK (
    length(btrim(key_id)) > 0
    AND length(key_id) <= 256
  ),
  ciphertext text NOT NULL CHECK (
    length(btrim(ciphertext)) > 0
    AND length(ciphertext) <= 131072
  ),
  nonce text CHECK (
    nonce IS NULL OR (
      length(btrim(nonce)) > 0
      AND length(nonce) <= 4096
    )
  ),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, credential_ref_id),
  UNIQUE (tenant_id, provider_id, slot_key, credential_ref_id)
);

CREATE INDEX credential_refs_provider_slot_idx
  ON security.credential_refs (
    tenant_id,
    provider_id,
    slot_key,
    active,
    updated_at DESC
  );

COMMENT ON TABLE security.credential_refs IS
  'Encrypted provider credential envelopes bound to tenant/provider/slot scope. Plaintext credential material is never stored in PostgreSQL.';
