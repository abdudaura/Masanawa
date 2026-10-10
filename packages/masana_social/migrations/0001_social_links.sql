-- Source-only, forward migration: AF00 must register this root after upgrade/restore review.
CREATE SCHEMA IF NOT EXISTS masana;
CREATE TABLE IF NOT EXISTS masana.social_identities (
  tenant_id text NOT NULL,
  identity_id text NOT NULL,
  character_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('whatsapp','telegram','instagram','facebook','youtube','tiktok','x')),
  provider_account_id text NOT NULL CHECK (length(provider_account_id) BETWEEN 1 AND 160),
  handle text NOT NULL CHECK (length(handle) BETWEEN 1 AND 160),
  public_url text NOT NULL CHECK (length(public_url) BETWEEN 9 AND 400 AND public_url LIKE 'https://%'),
  verified_at timestamptz,
  publish_state text NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft','published','revoked')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,identity_id),
  UNIQUE(tenant_id,provider,provider_account_id),
  UNIQUE(tenant_id,character_id,provider,provider_account_id),
  FOREIGN KEY(tenant_id,character_id) REFERENCES identity.characters(tenant_id,character_id),
  CHECK (publish_state <> 'published' OR verified_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS social_identities_public_idx
 ON masana.social_identities(tenant_id,character_id,provider)
 WHERE publish_state = 'published' AND verified_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS masana.social_connections (
  tenant_id text NOT NULL,
  identity_id text NOT NULL,
  connection_mode text NOT NULL DEFAULT 'profile_link_only'
    CHECK(connection_mode IN ('disabled','profile_link_only','manual_operator','verified_automation_eligible')),
  auth_ref text,
  authorization_ref text,
  authorization_checked_at timestamptz,
  permission_expiry timestamptz,
  capability_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(capability_json)='object'),
  health text NOT NULL DEFAULT 'link_only' CHECK(health IN ('link_only','healthy','degraded','unavailable')),
  paused boolean NOT NULL DEFAULT false,
  rate_budget integer NOT NULL DEFAULT 0 CHECK(rate_budget >= 0),
  revision bigint NOT NULL DEFAULT 1 CHECK(revision > 0),
  PRIMARY KEY(tenant_id,identity_id),
  FOREIGN KEY(tenant_id,identity_id) REFERENCES masana.social_identities(tenant_id,identity_id),
  CHECK(connection_mode <> 'verified_automation_eligible' OR
    (authorization_ref IS NOT NULL AND authorization_checked_at IS NOT NULL AND
     permission_expiry > authorization_checked_at))
);
CREATE TABLE IF NOT EXISTS masana.social_connection_audit (
  tenant_id text NOT NULL, audit_id text NOT NULL, identity_id text NOT NULL,
  actor_id text NOT NULL, action text NOT NULL, prior_revision bigint,
  new_revision bigint NOT NULL, evidence_ref text,
  happened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,audit_id),
  FOREIGN KEY(tenant_id,identity_id) REFERENCES masana.social_identities(tenant_id,identity_id)
);
CREATE TABLE IF NOT EXISTS masana.social_events (
  tenant_id text NOT NULL, provider text NOT NULL, provider_event_id text NOT NULL,
  identity_id text NOT NULL, external_fan_hash text NOT NULL,
  origin text NOT NULL, consent_scope text, status text NOT NULL DEFAULT 'held'
    CHECK(status IN ('held','eligible','processing','processed','rejected')),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,provider,provider_event_id),
  FOREIGN KEY(tenant_id,identity_id) REFERENCES masana.social_identities(tenant_id,identity_id)
);
CREATE TABLE IF NOT EXISTS masana.social_delivery_attempts (
  tenant_id text NOT NULL, attempt_id text NOT NULL, provider text NOT NULL,
  provider_event_id text NOT NULL, identity_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('blocked','pending','sent','retry','dead_letter')),
  retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
  next_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,attempt_id),
  FOREIGN KEY(tenant_id,provider,provider_event_id)
    REFERENCES masana.social_events(tenant_id,provider,provider_event_id),
  FOREIGN KEY(tenant_id,identity_id)
    REFERENCES masana.social_identities(tenant_id,identity_id)
);
