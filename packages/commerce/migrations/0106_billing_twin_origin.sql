ALTER TABLE commerce.billing_quotes
  ADD COLUMN originating_character_id text;

CREATE INDEX billing_quotes_originating_character_idx
  ON commerce.billing_quotes(tenant_id,originating_character_id,created_at DESC)
  WHERE originating_character_id IS NOT NULL;
