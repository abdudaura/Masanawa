CREATE TABLE IF NOT EXISTS talks.direct_twin_instructions (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  seat_id text NOT NULL,
  persona_id text NOT NULL,
  owner_user_id text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  instruction text NULL CHECK (instruction IS NULL OR length(btrim(instruction)) BETWEEN 1 AND 2000),
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NULL,
  PRIMARY KEY (tenant_id, talk_id, seat_id)
);

CREATE INDEX IF NOT EXISTS talks_direct_twin_expiry_idx
  ON talks.direct_twin_instructions (tenant_id, expires_at)
  WHERE expires_at IS NOT NULL;
