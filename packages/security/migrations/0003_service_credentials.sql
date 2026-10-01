CREATE TABLE security.service_credentials (
  service_id text NOT NULL CHECK (service_id ~ '^service_'),
  key_id text NOT NULL CHECK (
    length(btrim(key_id)) > 0
    AND length(key_id) <= 128
  ),
  credential_generation integer NOT NULL CHECK (credential_generation > 0),
  public_key_pem text NOT NULL CHECK (length(btrim(public_key_pem)) > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (service_id, key_id)
);

COMMENT ON TABLE security.service_credentials IS
  'Current public verification keys and credential generations for service workload authentication. Private key material is never stored here.';
