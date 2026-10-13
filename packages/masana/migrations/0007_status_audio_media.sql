-- Forward-only: keep portrait/banner/cover media intact while allowing
-- rights-cleared Masana original audio to use the *same* existing catalogue.
-- Historical media, financial balances, publications and approvals are untouched.
ALTER TABLE masana.character_media
 DROP CONSTRAINT IF EXISTS character_media_kind_check;
ALTER TABLE masana.character_media
 ADD CONSTRAINT character_media_kind_check
 CHECK (kind IN ('portrait','banner','cover','audio'));
