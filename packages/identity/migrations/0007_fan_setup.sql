-- C04/J01: additive fan profile, age self-attestation and one-time Masana disclosure.
-- Never modify historical financial/account rows or represent an attestation as verified age.
ALTER TABLE identity.users
  ADD COLUMN display_name text,
  ADD COLUMN avatar_media_id text,
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN interests text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN role_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN birth_year_verified smallint,
  ADD COLUMN age_attested_18plus_at timestamptz,
  ADD COLUMN masana_disclosure_version text,
  ADD COLUMN masana_disclosure_accepted_at timestamptz,
  ADD COLUMN fan_setup_completed_at timestamptz;

ALTER TABLE identity.users
  ADD CONSTRAINT fan_display_name_valid CHECK (
    display_name IS NULL OR
    (char_length(btrim(display_name)) BETWEEN 2 AND 60
      AND display_name !~ '[[:cntrl:]]')
  ),
  ADD CONSTRAINT fan_language_valid CHECK (preferred_language IN ('en','ha')),
  ADD CONSTRAINT fan_interests_limited CHECK (
    cardinality(interests) <= 5 AND
    interests <@ ARRAY['technology','learning','creative','business','wellbeing']::text[]
  ),
  ADD CONSTRAINT fan_age_year_valid CHECK (
    birth_year_verified IS NULL OR birth_year_verified BETWEEN 1900 AND 2100
  ),
  ADD CONSTRAINT fan_disclosure_consistent CHECK (
    (masana_disclosure_version IS NULL) =
    (masana_disclosure_accepted_at IS NULL)
  ),
  ADD CONSTRAINT fan_setup_complete_consistent CHECK (
    fan_setup_completed_at IS NULL OR (
      age_attested_18plus_at IS NOT NULL AND
      masana_disclosure_version = 'masana-ai-v1' AND
      masana_disclosure_accepted_at IS NOT NULL AND
      display_name IS NOT NULL
    )
  );

COMMENT ON COLUMN identity.users.age_attested_18plus_at IS
  'User self-attestation at onboarding; NOT verified birth date or age.';
COMMENT ON COLUMN identity.users.birth_year_verified IS
  'Reserved for a qualified verification process; never populated by a self-attestation.';
