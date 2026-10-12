-- Forward-only J11 extension; identity.relationships and memory.records remain canonical.
CREATE TABLE memory.fan_controls (
 tenant_id text NOT NULL, relationship_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,relationship_id),
 FOREIGN KEY(tenant_id,relationship_id) REFERENCES identity.relationships(tenant_id,relationship_id)
);
CREATE TABLE memory.fan_control_audit (
 tenant_id text NOT NULL,relationship_id text NOT NULL,revision bigint NOT NULL,
 enabled boolean NOT NULL,actor_user_id text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,relationship_id,revision),
 FOREIGN KEY(tenant_id,relationship_id) REFERENCES identity.relationships(tenant_id,relationship_id)
);
CREATE TABLE memory.fan_erase_requests (
 tenant_id text NOT NULL,request_id text NOT NULL,relationship_id text NOT NULL,
 actor_user_id text NOT NULL,target_record_id text,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 128),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','applying','completed','needs_review')),
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),resolved_at timestamptz,
 PRIMARY KEY(tenant_id,request_id), UNIQUE(tenant_id,relationship_id,idempotency_key),
 FOREIGN KEY(tenant_id,relationship_id) REFERENCES identity.relationships(tenant_id,relationship_id),
 FOREIGN KEY(tenant_id,target_record_id) REFERENCES memory.records(tenant_id,memory_record_id)
);
CREATE INDEX fan_erase_queue_idx ON memory.fan_erase_requests(state,requested_at)
 WHERE state IN ('queued','applying');
CREATE FUNCTION memory.reject_fan_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Fan memory consent audit is append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER fan_control_audit_immutable BEFORE UPDATE OR DELETE ON memory.fan_control_audit
 FOR EACH ROW EXECUTE FUNCTION memory.reject_fan_audit_mutation();
