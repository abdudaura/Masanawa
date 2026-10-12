ALTER TABLE agents.masana_call_history ADD COLUMN direction text NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming','outgoing'));
ALTER TABLE agents.masana_call_history ADD COLUMN incoming_outcome text CHECK (incoming_outcome IN ('accepted','declined','cancelled','missed'));
CREATE TABLE agents.masana_incoming_calls (
 tenant_id text NOT NULL,user_id text NOT NULL,call_id uuid NOT NULL,character_id text NOT NULL,display_name text NOT NULL,
 request_id text NOT NULL,state text NOT NULL DEFAULT 'ringing' CHECK(state IN ('ringing','accepted','declined','cancelled','missed')),
 created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz(3) NOT NULL,
 token_status text NOT NULL DEFAULT 'idle' CHECK(token_status IN ('idle','issuing','issued','unknown')),admission_id text,token_started_at timestamptz,
 PRIMARY KEY(tenant_id,user_id,call_id),UNIQUE(tenant_id,user_id,request_id),CHECK(expires_at>created_at)
);
CREATE INDEX masana_incoming_expiry_idx ON agents.masana_incoming_calls(expires_at) WHERE state='ringing';
CREATE TABLE agents.masana_incoming_push_outbox (
 tenant_id text NOT NULL,user_id text NOT NULL,call_id uuid NOT NULL,attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(),lease_id uuid,lease_until timestamptz,delivered_at timestamptz,
 PRIMARY KEY(tenant_id,user_id,call_id),FOREIGN KEY(tenant_id,user_id,call_id) REFERENCES agents.masana_incoming_calls
);
