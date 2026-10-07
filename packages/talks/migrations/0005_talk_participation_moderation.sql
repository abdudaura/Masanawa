CREATE TABLE IF NOT EXISTS talks.participation (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  user_id text NOT NULL,
  reaction text NULL CHECK (
    reaction IS NULL OR reaction IN ('❤️','👏','😂','💯','🤔','🔥')
  ),
  reaction_changed_at timestamptz NULL,
  hand_status text NOT NULL DEFAULT 'idle'
    CHECK (hand_status IN ('idle','raised','accepted','declined')),
  hand_request_id text NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, talk_id, user_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talks.seat_requests (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  request_id text NOT NULL,
  requester_user_id text NULL,
  kind text NOT NULL
    CHECK (kind IN ('human_speaker','sponsored_expert','sponsored_twin')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  detail text NOT NULL DEFAULT '',
  avatar_url text NULL,
  amount_label text NULL,
  participant_id text NOT NULL,
  participant_kind text NOT NULL CHECK (participant_kind IN ('human','expert','twin')),
  persona_id text NULL,
  commerce_authorization_id text NULL,
  status text NOT NULL
    CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, request_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS talks_one_pending_human_request_idx
  ON talks.seat_requests (tenant_id, talk_id, requester_user_id)
  WHERE kind = 'human_speaker'
    AND status = 'pending'
    AND requester_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS talks_pending_requests_idx
  ON talks.seat_requests (tenant_id, talk_id, created_at ASC)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS talks.participants (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  participant_id text NOT NULL,
  user_id text NULL,
  kind text NOT NULL CHECK (kind IN ('human','expert','twin')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  avatar_url text NULL,
  is_muted boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK (state IN ('active','removed')),
  source_request_id text NULL,
  joined_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, talk_id, participant_id),
  FOREIGN KEY (tenant_id, talk_id)
    REFERENCES talks.talks(tenant_id, talk_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS talks_one_active_human_seat_idx
  ON talks.participants (tenant_id, talk_id, user_id)
  WHERE kind = 'human' AND state = 'active' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS talks_active_participants_idx
  ON talks.participants (tenant_id, talk_id, joined_at ASC)
  WHERE state = 'active';
