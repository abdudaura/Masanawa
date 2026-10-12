-- Platform Masana have no human creator beneficiary. Preserve historical owners.
ALTER TABLE commerce.twin_voice_quotes ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE commerce.twin_voice_admissions ALTER COLUMN owner_user_id DROP NOT NULL;

ALTER TABLE commerce.twin_voice_quotes ADD CONSTRAINT platform_voice_zero_owner_share
  CHECK (owner_user_id IS NOT NULL OR COALESCE((
    definition->'ownerUserId' = 'null'::jsonb AND
    (definition->>'ownerShareBasisPoints')::integer = 0
  ), false));
