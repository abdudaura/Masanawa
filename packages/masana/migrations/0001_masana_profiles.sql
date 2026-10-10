-- New, isolated Masana profile data. Existing identity and historical financial schemas are untouched.
CREATE SCHEMA IF NOT EXISTS masana;
CREATE TABLE masana.character_revisions (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','retired')),
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'
    AND length(profile->>'displayName') BETWEEN 1 AND 100
    AND length(profile->>'profession') BETWEEN 1 AND 100
    AND (profile->>'handle') ~ '^[a-z0-9][a-z0-9._-]{1,39}$'),
  voice_profile_id text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, character_id, revision),
  FOREIGN KEY (tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id),
  CHECK ((state = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
       OR (state <> 'approved'))
);
CREATE UNIQUE INDEX masana_one_approved_revision
  ON masana.character_revisions(tenant_id,character_id) WHERE state = 'approved';
CREATE UNIQUE INDEX masana_approved_handle
  ON masana.character_revisions(tenant_id,lower(profile->>'handle')) WHERE state = 'approved';
CREATE INDEX masana_revision_history ON masana.character_revisions(tenant_id,character_id,revision DESC);
CREATE TABLE masana.character_media (
  tenant_id text NOT NULL,
  media_id text NOT NULL,
  character_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('portrait','banner','cover')),
  object_key text NOT NULL,
  rights_note text NOT NULL CHECK (length(btrim(rights_note)) > 4),
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,media_id),
  FOREIGN KEY(tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id)
);
-- Defence in depth: even privileged direct SQL may never approve unverified imagery.
CREATE OR REPLACE FUNCTION masana.require_rights_cleared_approved_media()
RETURNS trigger LANGUAGE plpgsql AS $
DECLARE approved_kinds integer;
BEGIN
  IF NEW.state <> 'approved' THEN RETURN NEW; END IF;
  SELECT count(DISTINCT m.kind) INTO approved_kinds
  FROM masana.character_media m
  WHERE m.tenant_id=NEW.tenant_id AND m.character_id=NEW.character_id
    AND length(btrim(m.rights_note))>4 AND length(btrim(m.approved_by))>0
    AND ((m.kind='portrait' AND m.media_id=NEW.profile->>'portraitMediaId')
      OR (m.kind='banner' AND m.media_id=NEW.profile->>'bannerMediaId'));
  IF approved_kinds <> 2 THEN
    RAISE EXCEPTION 'masana_media_unverified' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $;
CREATE TRIGGER masana_approval_requires_media
BEFORE INSERT OR UPDATE ON masana.character_revisions
FOR EACH ROW WHEN (NEW.state='approved')
EXECUTE FUNCTION masana.require_rights_cleared_approved_media();

CREATE TABLE masana.follows (
  tenant_id text NOT NULL,
  fan_user_id text NOT NULL,
  character_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,fan_user_id,character_id),
  FOREIGN KEY(tenant_id,fan_user_id) REFERENCES identity.users(tenant_id,user_id),
  FOREIGN KEY(tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id)
);
CREATE INDEX masana_followers_by_character ON masana.follows(tenant_id,character_id,created_at DESC);
CREATE TABLE masana.follow_counts (
  tenant_id text NOT NULL,
  character_id text NOT NULL,
  follower_count bigint NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,character_id),
  FOREIGN KEY(tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id)
);
CREATE OR REPLACE FUNCTION masana.require_platform_masana()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM identity.characters c
    JOIN identity.character_ownership o USING (tenant_id,character_id)
    WHERE c.tenant_id=NEW.tenant_id AND c.character_id=NEW.character_id
      AND c.state='active' AND o.kind='platform'
  ) THEN RAISE EXCEPTION 'not_platform_masana' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER masana_revision_platform BEFORE INSERT OR UPDATE ON masana.character_revisions
  FOR EACH ROW EXECUTE FUNCTION masana.require_platform_masana();
CREATE OR REPLACE FUNCTION masana.require_visible_masana()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM masana.character_revisions r
     JOIN identity.characters c USING(tenant_id,character_id)
     JOIN identity.character_ownership o USING(tenant_id,character_id)
     WHERE r.tenant_id=NEW.tenant_id AND r.character_id=NEW.character_id
       AND r.state='approved' AND c.state='active' AND o.kind='platform')
     OR NOT EXISTS(SELECT 1 FROM identity.users u
       WHERE u.tenant_id=NEW.tenant_id AND u.user_id=NEW.fan_user_id AND u.state='active')
  THEN RAISE EXCEPTION 'fan_or_masana_not_eligible' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER masana_follow_eligible BEFORE INSERT ON masana.follows
  FOR EACH ROW EXECUTE FUNCTION masana.require_visible_masana();
