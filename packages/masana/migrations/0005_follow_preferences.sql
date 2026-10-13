-- C46. Applied after the existing immutable Masana follow authority.
-- There is no separate following identity, notification registry or fan profile.
CREATE TABLE masana.follow_preferences (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  character_id text NOT NULL,
  muted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,fan_user_id,character_id),
  FOREIGN KEY (tenant_id,fan_user_id,character_id)
    REFERENCES masana.follows(tenant_id,fan_user_id,character_id) ON DELETE CASCADE
);
CREATE INDEX masana_follow_preferences_muted
  ON masana.follow_preferences(tenant_id,fan_user_id,muted)
  WHERE muted = true;
