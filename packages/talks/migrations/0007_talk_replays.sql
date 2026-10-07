CREATE TABLE IF NOT EXISTS talks.replays (
  tenant_id text NOT NULL,
  talk_id text NOT NULL,
  recording_id text NOT NULL,
  host_user_id text NOT NULL,
  session_json jsonb NOT NULL CHECK (jsonb_typeof(session_json)='object'),
  egress_id text NULL,
  object_key text NOT NULL,
  provider_status text NOT NULL DEFAULT 'requested'
    CHECK (provider_status IN ('requested','starting','active','ending','complete','failed','aborted','limit_reached')),
  provider_error text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,talk_id),
  UNIQUE (tenant_id,recording_id),
  UNIQUE (tenant_id,egress_id),
  FOREIGN KEY (tenant_id,talk_id)
    REFERENCES talks.talks(tenant_id,talk_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS talks_replays_public_idx
  ON talks.replays (
    tenant_id,
    (session_json ->> 'publicationState'),
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS talks_replays_provider_pending_idx
  ON talks.replays (tenant_id,provider_status,updated_at)
  WHERE provider_status IN ('requested','starting','active','ending');
