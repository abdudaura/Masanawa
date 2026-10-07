ALTER TABLE talks.human_invitations
  DROP CONSTRAINT IF EXISTS human_invitations_status_check;

ALTER TABLE talks.human_invitations
  ADD CONSTRAINT human_invitations_status_check
  CHECK (status IN ('pending','accepted','declined','left'));
