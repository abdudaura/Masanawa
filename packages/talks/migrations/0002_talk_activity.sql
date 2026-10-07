CREATE TABLE IF NOT EXISTS talks.activity (
  tenant_id text NOT NULL,
  activity_id text NOT NULL,
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'talk_invitation',
    'raise_hand_accepted',
    'raise_hand_declined',
    'ai_seat_sponsored',
    'ai_seat_accepted',
    'ai_seat_declined',
    'follow',
    'gift',
    'twin_hired',
    'earning',
    'replay_milestone',
    'platform'
  )),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  detail text NOT NULL CHECK (length(btrim(detail)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL,
  talk_id text NULL,
  profile_public_id text NULL,
  persona_id text NULL,
  transaction_id text NULL,
  amount_label text NULL CHECK (amount_label IS NULL OR length(amount_label) <= 80),
  requires_action boolean NOT NULL DEFAULT false,
  action_label text NULL CHECK (action_label IS NULL OR length(action_label) <= 80),
  unread boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, activity_id)
);

CREATE INDEX IF NOT EXISTS talks_activity_user_time_idx
  ON talks.activity (tenant_id, user_id, created_at DESC, activity_id DESC);

CREATE INDEX IF NOT EXISTS talks_activity_user_kind_idx
  ON talks.activity (tenant_id, user_id, kind, created_at DESC);
