-- Forward-only Rooms invitation and moderator lifecycle. Existing fan membership
-- and identity authorities are reused; no financial or paid entitlement change.
-- Gateway remains disabled until the new schema and customer session qualify.
ALTER TABLE rooms.memberships ADD COLUMN role text NOT NULL DEFAULT 'member'
 CHECK (role IN ('member','moderator'));
CREATE TABLE rooms.membership_invites (
 tenant_id text NOT NULL, room_id text NOT NULL, invite_id text NOT NULL,
 token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 created_by text NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, accepted_by text, accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,room_id,invite_id), UNIQUE (token_hash),
 FOREIGN KEY (tenant_id,room_id) REFERENCES rooms.rooms(tenant_id,room_id),
 FOREIGN KEY (tenant_id,created_by) REFERENCES identity.users(tenant_id,user_id),
 FOREIGN KEY (tenant_id,accepted_by) REFERENCES identity.users(tenant_id,user_id),
 CHECK ((accepted_by IS NULL) = (accepted_at IS NULL)),
 CHECK (expires_at > created_at)
);
CREATE INDEX membership_invites_room_idx ON rooms.membership_invites
 (tenant_id,room_id,created_at DESC);
