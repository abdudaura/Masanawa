ALTER TABLE commerce.ngn_funding_intents
  ADD COLUMN originating_character_id text;

CREATE INDEX ngn_funding_originating_character_idx
  ON commerce.ngn_funding_intents(
    tenant_id,originating_character_id,created_at DESC
  )
  WHERE originating_character_id IS NOT NULL;
