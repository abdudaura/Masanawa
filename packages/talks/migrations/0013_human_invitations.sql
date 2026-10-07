CREATE TABLE IF NOT EXISTS talks.human_invitations (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  host_user_id text NOT NULL,
  invitee_user_id text NOT NULL,
  invitee_handle text NOT NULL,
  invitee_display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id,invitee_user_id)
);

CREATE INDEX IF NOT EXISTS talks_human_invitations_recipient_idx
  ON talks.human_invitations (tenant_id,invitee_user_id,status,updated_at DESC);
