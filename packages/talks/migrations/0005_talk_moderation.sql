ALTER TABLE talks.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_role_check;

ALTER TABLE talks.live_sessions
  ADD CONSTRAINT live_sessions_role_check
  CHECK (role IN ('host','speaker','listener'));

ALTER TABLE talks.live_sessions
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS talks.participation (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  user_id text NOT NULL,
  display_name text NOT NULL,
  hand_status text NOT NULL DEFAULT 'idle'
    CHECK (hand_status IN ('idle','raised','accepted','declined')),
  reaction text NULL CHECK (reaction IS NULL OR reaction IN ('❤️','👏','😂','💯','🤔','🔥')),
  reaction_updated_at timestamptz NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id,user_id)
);

CREATE TABLE IF NOT EXISTS talks.host_requests (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  request_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('human_speaker','sponsored_expert','sponsored_twin')),
  requester_user_id text NULL,
  persona_id text NULL,
  display_name text NOT NULL,
  detail text NULL,
  avatar_url text NULL,
  amount_label text NULL,
  commercial_authorization_id text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id,request_id)
);

CREATE INDEX IF NOT EXISTS talks_host_requests_pending_idx
  ON talks.host_requests (tenant_id,talk_id,status,created_at);

CREATE TABLE IF NOT EXISTS talks.talk_seats (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  participant_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('human','expert','twin')),
  user_id text NULL,
  persona_id text NULL,
  display_name text NOT NULL,
  avatar_url text NULL,
  is_host boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  admitted_at timestamptz NOT NULL,
  removed_at timestamptz NULL,
  PRIMARY KEY (tenant_id,talk_id,participant_id),
  CHECK (NOT is_host OR kind='human')
);

CREATE UNIQUE INDEX IF NOT EXISTS talks_talk_seats_active_user_idx
  ON talks.talk_seats (tenant_id,talk_id,user_id)
  WHERE active AND user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS talks.live_canonical (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  revision integer NOT NULL CHECK (revision>=1),
  session_json jsonb NOT NULL CHECK (jsonb_typeof(session_json)='object'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id)
);
