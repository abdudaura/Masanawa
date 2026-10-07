CREATE TABLE IF NOT EXISTS commerce.talk_ai_seat_quotes (
  tenant_id text NOT NULL,
  quote_id text NOT NULL CHECK (quote_id ~ '^quote_'),
  talk_id text NOT NULL,
  persona_id text NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^request_'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, quote_id),
  UNIQUE (tenant_id, talk_id, request_id),
  CHECK (expires_at > created_at),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'quoteId' IS NOT DISTINCT FROM quote_id),
  CHECK (definition ->> 'talkId' IS NOT DISTINCT FROM talk_id),
  CHECK (definition ->> 'personaId' IS NOT DISTINCT FROM persona_id)
);

CREATE INDEX IF NOT EXISTS commerce_talk_ai_seat_talk_state_idx
  ON commerce.talk_ai_seat_quotes (
    tenant_id,
    talk_id,
    (definition ->> 'state'),
    expires_at
  );

CREATE INDEX IF NOT EXISTS commerce_talk_ai_seat_payer_idx
  ON commerce.talk_ai_seat_quotes (
    tenant_id,
    (definition ->> 'payerUserId'),
    created_at DESC
  );
