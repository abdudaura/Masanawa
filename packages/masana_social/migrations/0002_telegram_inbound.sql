-- J22: additive private Telegram fan consent on the existing masana social identity,
-- existing provider-event journal and events.outbox. Never stores Telegram IDs, tokens
-- or raw chat text. AF00 alone may register/apply after fresh+upgrade+restore review.
CREATE TABLE masana.telegram_fan_consents (
 tenant_id text NOT NULL, identity_id text NOT NULL, external_fan_hash text NOT NULL
   CHECK(external_fan_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN ('pending','opted_in','revoked')),
 consent_version text NOT NULL CHECK(length(consent_version) BETWEEN 1 AND 80),
 last_update_id bigint NOT NULL CHECK(last_update_id>=0),
 changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,identity_id,external_fan_hash),
 FOREIGN KEY(tenant_id,identity_id) REFERENCES masana.social_identities(tenant_id,identity_id)
);
CREATE INDEX telegram_fan_consent_status_idx
 ON masana.telegram_fan_consents(tenant_id,identity_id,state)
 WHERE state='opted_in';
-- Provider update dedupe remains in masana.social_events(tenant_id,provider,provider_event_id).
-- Worker leasing/retries remain in canonical events.outbox. No second queue or wallet.
