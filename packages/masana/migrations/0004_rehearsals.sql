-- A04: Staff-only ephemeral draft rehearsal. Source only: never apply to live DB without AF00 restore/upgrade review.
CREATE TABLE masana.rehearsal_runs (
 tenant_id text NOT NULL,
 run_id text NOT NULL,
 character_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 staff_id text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('chat','post','call')),
 prompt text NOT NULL CHECK(length(prompt) BETWEEN 1 AND 2000),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 128),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','failed')),
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 3),
 lease_token text,
 lease_until timestamptz,
 preview jsonb,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,run_id),
 UNIQUE(tenant_id,staff_id,idempotency_key),
 FOREIGN KEY (tenant_id,character_id,revision) REFERENCES masana.character_revisions(tenant_id,character_id,revision),
 FOREIGN KEY (tenant_id,staff_id) REFERENCES identity.users(tenant_id,user_id),
 CHECK ((state='running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state<>'running' AND lease_token IS NULL AND lease_until IS NULL)),
 CHECK (preview IS NULL OR jsonb_typeof(preview)='object')
);
CREATE INDEX masana_rehearsals_staff ON masana.rehearsal_runs(tenant_id,staff_id,created_at DESC);
CREATE INDEX masana_rehearsals_recovery ON masana.rehearsal_runs(tenant_id,lease_until) WHERE state='running';
-- Rehearsal never writes published character revisions, public posts, calls, fan messages, or commerce.