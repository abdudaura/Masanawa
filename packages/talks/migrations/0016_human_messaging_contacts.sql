-- C01: private person-to-person contact eligibility. No AI persona or public Talk admission.
-- Fail-closed by default. Every row is tenant and canonical identity scoped.
CREATE TABLE talks.human_dm_preferences (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  admission_policy text NOT NULL DEFAULT 'requests'
    CHECK (admission_policy IN ('anyone','requests','nobody')),
  discoverable_by_handle boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);

CREATE TABLE talks.human_dm_contact_requests (
  tenant_id text NOT NULL,
  first_user_id text NOT NULL,
  second_user_id text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  -- A revocation is a durable tombstone, unlike an ordinary decline.
  revoked_by text,
  -- Monotonically advances on every fresh invitation after revocation.
  -- An old approval must never accept a newer invitation.
  request_revision bigint NOT NULL DEFAULT 1 CHECK (request_revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,first_user_id,second_user_id),
  CHECK (first_user_id < second_user_id),
  CHECK (requested_by IN (first_user_id,second_user_id)),
  CHECK (revoked_by IS NULL OR (status='declined' AND revoked_by IN (first_user_id,second_user_id))),
  FOREIGN KEY (tenant_id,first_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,second_user_id) REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);

CREATE INDEX human_dm_contacts_second_idx
  ON talks.human_dm_contact_requests (tenant_id,second_user_id,updated_at DESC);
CREATE INDEX human_dm_contacts_requested_by_idx
  ON talks.human_dm_contact_requests (tenant_id,requested_by,updated_at DESC);
-- Privilege checks in the service/repository are mandatory even with table constraints.

