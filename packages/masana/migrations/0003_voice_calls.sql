-- J04: source-only, forward-only. AF00 registers after R1/restore proof.
-- Existing characters, user identity, ledger and historical calls remain untouched.
CREATE TABLE masana.call_sessions (
  tenant_id text NOT NULL,
  call_id text NOT NULL,
  fan_user_id text NOT NULL,
  character_id text NOT NULL,
  request_id text NOT NULL,
  room_name text NOT NULL,
  state text NOT NULL DEFAULT 'connecting'
    CHECK (state IN ('connecting','active','ended','failed','expired')),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz NOT NULL,
  billed_seconds integer NOT NULL DEFAULT 0 CHECK (billed_seconds >= 0),
  PRIMARY KEY (tenant_id,call_id),
  UNIQUE (tenant_id,fan_user_id,request_id),
  UNIQUE (tenant_id,room_name),
  FOREIGN KEY (tenant_id,fan_user_id) REFERENCES identity.users(tenant_id,user_id),
  FOREIGN KEY (tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id),
  CHECK (expires_at > created_at),
  CHECK (billed_seconds <= 900),
  CHECK (ended_at IS NULL OR ended_at >= created_at)
);
CREATE UNIQUE INDEX masana_one_live_fan_call
  ON masana.call_sessions(tenant_id,fan_user_id)
  WHERE state IN ('connecting','active');
CREATE INDEX masana_call_expiry
  ON masana.call_sessions(expires_at,tenant_id,call_id)
  WHERE state IN ('connecting','active');
CREATE INDEX masana_call_history
  ON masana.call_sessions(tenant_id,fan_user_id,created_at DESC);
CREATE OR REPLACE FUNCTION masana.admit_platform_voice_call()
RETURNS trigger LANGUAGE plpgsql AS $call$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM masana.character_revisions r
      JOIN identity.characters c USING(tenant_id,character_id)
      JOIN identity.character_ownership o USING(tenant_id,character_id)
      JOIN identity.users u ON u.tenant_id=NEW.tenant_id AND u.user_id=NEW.fan_user_id
    WHERE r.tenant_id=NEW.tenant_id AND r.character_id=NEW.character_id
      AND r.state='approved' AND btrim(coalesce(r.voice_profile_id,'')) <> ''
      AND c.state='active' AND o.kind='platform' AND u.state='active'
  ) THEN
    RAISE EXCEPTION 'masana_call_forbidden' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $call$;
CREATE TRIGGER masana_voice_call_admission
  BEFORE INSERT ON masana.call_sessions
  FOR EACH ROW EXECUTE FUNCTION masana.admit_platform_voice_call();
