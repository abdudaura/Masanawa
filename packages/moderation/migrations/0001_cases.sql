-- J13: forward-only, tenant-fenced and independent of legacy Talk safety history.
CREATE SCHEMA IF NOT EXISTS moderation;
CREATE TABLE IF NOT EXISTS moderation.cases (
 tenant_id text NOT NULL, case_id text NOT NULL, reporter_user_id text NOT NULL,
 target_kind text NOT NULL CHECK (target_kind IN ('post','comment','room_reply','video','transaction','account')),
 target_id text NOT NULL, category text NOT NULL CHECK (category IN ('spam','harassment','unsafe','copyright','fraud','other')),
 details text NOT NULL DEFAULT '', client_request_id text NOT NULL, version int NOT NULL DEFAULT 1 CHECK (version > 0),
 state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','investigating','action_proposed','awaiting_review','actioned','dismissed','appealed','closed')),
 sla_due_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,case_id), UNIQUE(tenant_id,reporter_user_id,client_request_id)
);
CREATE INDEX IF NOT EXISTS moderation_cases_queue ON moderation.cases(tenant_id,state,sla_due_at,case_id);
CREATE INDEX IF NOT EXISTS moderation_cases_reporter ON moderation.cases(tenant_id,reporter_user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS moderation.case_events (
 tenant_id text NOT NULL, event_id text NOT NULL, case_id text NOT NULL, actor_id text NOT NULL,
 kind text NOT NULL, detail text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES moderation.cases(tenant_id,case_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS moderation_case_events_order ON moderation.case_events(tenant_id,case_id,created_at,event_id);
CREATE TABLE IF NOT EXISTS moderation.evidence_refs (
 tenant_id text NOT NULL, evidence_id text NOT NULL, case_id text NOT NULL, source_kind text NOT NULL,
 source_id text NOT NULL, submitted_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,evidence_id), FOREIGN KEY(tenant_id,case_id) REFERENCES moderation.cases(tenant_id,case_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS moderation.actions (
 tenant_id text NOT NULL, action_id text NOT NULL, case_id text NOT NULL,
 target_kind text NOT NULL, target_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('hide_comment','rate_limit','room_mute','user_ban','user_unban')),
 state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','rejected','applied','failed','reversed')),
 reason text NOT NULL, proposed_by text NOT NULL,
 approved_by text, second_approved_by text, expires_at timestamptz,
 version int NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,action_id),FOREIGN KEY(tenant_id,case_id) REFERENCES moderation.cases(tenant_id,case_id) ON DELETE RESTRICT,
 CHECK (second_approved_by IS NULL OR (approved_by IS NOT NULL AND second_approved_by <> approved_by)),
 CHECK (kind NOT IN ('user_ban','user_unban') OR expires_at IS NULL)
);
CREATE INDEX IF NOT EXISTS moderation_actions_ready ON moderation.actions(state,created_at) WHERE state='approved';
CREATE INDEX IF NOT EXISTS moderation_actions_expiry ON moderation.actions(expires_at) WHERE state='applied' AND expires_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS moderation.appeals (
 tenant_id text NOT NULL, appeal_id text NOT NULL, case_id text NOT NULL, appellant_user_id text NOT NULL,
 reason text NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','under_review','upheld','rejected')),
 reviewed_by text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 PRIMARY KEY(tenant_id,appeal_id), FOREIGN KEY(tenant_id,case_id) REFERENCES moderation.cases(tenant_id,case_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS moderation_appeals_queue ON moderation.appeals(tenant_id,state,created_at);
CREATE TABLE IF NOT EXISTS moderation.policy_revisions (
 tenant_id text NOT NULL, revision int NOT NULL, policy jsonb NOT NULL, approved_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,revision)
);
