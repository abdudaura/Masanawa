CREATE TABLE commerce.twin_credit_operations (
  tenant_id text NOT NULL,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 256),
  kind text NOT NULL CHECK (kind IN ('transfer','gift')),
  sender_user_id text NOT NULL,
  recipient_user_id text NOT NULL,
  character_id text,
  amount_credits bigint NOT NULL CHECK (amount_credits > 0),
  ledger_entry_id text NOT NULL CHECK (ledger_entry_id ~ '^ledger-entry_'),
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, request_id),
  UNIQUE (tenant_id, ledger_entry_id),
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE INDEX twin_credit_operations_actor_idx
  ON commerce.twin_credit_operations(tenant_id, sender_user_id, completed_at DESC);
CREATE INDEX twin_credit_operations_pair_idx
  ON commerce.twin_credit_operations(tenant_id, sender_user_id, recipient_user_id, completed_at DESC);

CREATE TABLE commerce.twin_commission_policy_revisions (
  tenant_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('external-funding','commerce-purchase')),
  revision bigint NOT NULL CHECK (revision > 0),
  enabled boolean NOT NULL,
  rate_basis_points integer NOT NULL CHECK (rate_basis_points BETWEEN 0 AND 10000),
  minimum_commission_credits bigint NOT NULL CHECK (minimum_commission_credits >= 0),
  maximum_commission_credits bigint,
  effective_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  PRIMARY KEY (tenant_id,event_type,revision),
  CHECK (maximum_commission_credits IS NULL OR maximum_commission_credits >= minimum_commission_credits)
);

CREATE TABLE commerce.twin_attributions (
  tenant_id text NOT NULL,
  attribution_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  customer_user_id text,
  event_type text NOT NULL CHECK (event_type IN ('external-funding','commerce-purchase')),
  operation_id text NOT NULL,
  policy_revision bigint NOT NULL CHECK (policy_revision > 0),
  attributed_at timestamptz NOT NULL,
  expires_at timestamptz,
  self_attribution boolean NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  PRIMARY KEY (tenant_id, attribution_id),
  UNIQUE (tenant_id,event_type,operation_id)
);

CREATE TABLE commerce.twin_commission_settlements (
  tenant_id text NOT NULL,
  settlement_id text NOT NULL,
  attribution_id text NOT NULL,
  operation_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('external-funding','commerce-purchase')),
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  base_credits bigint NOT NULL CHECK (base_credits >= 0),
  commission_credits bigint NOT NULL CHECK (commission_credits >= 0),
  policy_revision bigint NOT NULL CHECK (policy_revision > 0),
  ledger_entry_id text NOT NULL CHECK (ledger_entry_id ~ '^ledger-entry_'),
  reversed_credits bigint NOT NULL DEFAULT 0 CHECK (reversed_credits >= 0 AND reversed_credits <= commission_credits),
  settled_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,settlement_id),
  UNIQUE (tenant_id,operation_id),
  FOREIGN KEY (tenant_id,attribution_id) REFERENCES commerce.twin_attributions(tenant_id,attribution_id)
);

CREATE TABLE commerce.twin_commission_reversals (
  tenant_id text NOT NULL,
  reversal_id text NOT NULL,
  operation_id text NOT NULL,
  amount_credits bigint NOT NULL CHECK (amount_credits > 0),
  ledger_entry_id text NOT NULL CHECK (ledger_entry_id ~ '^ledger-entry_'),
  reversed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,reversal_id)
);

CREATE TABLE commerce.paid_feature_trial_policy_revisions (
  tenant_id text NOT NULL,
  feature text NOT NULL CHECK (feature IN ('twin-voice','owner-access','premium-twin')),
  revision bigint NOT NULL CHECK (revision > 0),
  enabled boolean NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  max_units bigint,
  created_at timestamptz NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  PRIMARY KEY (tenant_id,feature,revision),
  CHECK (max_units IS NULL OR max_units > 0)
);

CREATE TABLE commerce.paid_feature_trial_usage (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  feature text NOT NULL CHECK (feature IN ('twin-voice','owner-access','premium-twin')),
  started_at timestamptz,
  consumed_units bigint NOT NULL DEFAULT 0 CHECK (consumed_units >= 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,feature)
);

CREATE TABLE commerce.paid_feature_trial_consumptions (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  feature text NOT NULL,
  policy_revision bigint NOT NULL CHECK (policy_revision > 0),
  idempotency_key text NOT NULL,
  units bigint NOT NULL CHECK (units > 0),
  consumed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,user_id,feature,idempotency_key)
);

CREATE TABLE commerce.twin_voice_quotes (
  tenant_id text NOT NULL,
  quote_id text NOT NULL,
  user_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,quote_id),
  CHECK (expires_at > created_at)
);

CREATE TABLE commerce.twin_voice_admissions (
  tenant_id text NOT NULL,
  admission_id text NOT NULL,
  quote_id text NOT NULL,
  user_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  charge_mode text NOT NULL CHECK (charge_mode IN ('trial','paid')),
  spend_cap_credits bigint NOT NULL CHECK (spend_cap_credits >= 0),
  reservation_ledger_entry_id text,
  admitted_at timestamptz NOT NULL,
  started_at timestamptz,
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  PRIMARY KEY (tenant_id,admission_id),
  UNIQUE (tenant_id,quote_id),
  FOREIGN KEY (tenant_id,quote_id) REFERENCES commerce.twin_voice_quotes(tenant_id,quote_id)
);

CREATE TABLE commerce.twin_voice_settlements (
  tenant_id text NOT NULL,
  admission_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('completed','interrupted','ambiguous','failed-before-media')),
  verified_seconds integer NOT NULL CHECK (verified_seconds BETWEEN 0 AND 86400),
  settlement jsonb NOT NULL CHECK (jsonb_typeof(settlement)='object'),
  settled_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,admission_id),
  FOREIGN KEY (tenant_id,admission_id) REFERENCES commerce.twin_voice_admissions(tenant_id,admission_id)
);

CREATE TABLE commerce.owner_access_quotes (
  tenant_id text NOT NULL,
  quote_id text NOT NULL,
  requester_user_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,quote_id),
  CHECK (expires_at > created_at)
);

CREATE TABLE commerce.owner_access_offerings (
  tenant_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,owner_user_id)
);

CREATE TABLE commerce.owner_access_requests (
  tenant_id text NOT NULL,
  request_id text NOT NULL,
  requester_user_id text NOT NULL,
  owner_user_id text NOT NULL,
  character_id text NOT NULL,
  state text NOT NULL,
  reservation_id text,
  reserved_credits bigint NOT NULL CHECK (reserved_credits >= 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,request_id)
);
CREATE INDEX owner_access_owner_state_idx
  ON commerce.owner_access_requests(tenant_id,owner_user_id,state,updated_at DESC);
CREATE INDEX owner_access_requester_idx
  ON commerce.owner_access_requests(tenant_id,requester_user_id,updated_at DESC);

CREATE TABLE commerce.twin_safety_blocks (
  tenant_id text NOT NULL,
  actor_user_id text NOT NULL,
  character_id text NOT NULL,
  blocked_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,actor_user_id,character_id)
);

CREATE TABLE commerce.twin_safety_reports (
  tenant_id text NOT NULL,
  report_id text NOT NULL,
  reporter_user_id text NOT NULL,
  character_id text NOT NULL,
  reason text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,report_id)
);

CREATE OR REPLACE FUNCTION commerce.reject_twin_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Twin economy history is immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER twin_credit_operation_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_credit_operations
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER twin_attribution_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_attributions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER twin_commission_policy_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_commission_policy_revisions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER paid_trial_policy_immutable
BEFORE UPDATE OR DELETE ON commerce.paid_feature_trial_policy_revisions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER paid_trial_consumption_immutable
BEFORE UPDATE OR DELETE ON commerce.paid_feature_trial_consumptions
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER twin_voice_quote_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_voice_quotes
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER twin_voice_settlement_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_voice_settlements
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER owner_access_quote_immutable
BEFORE UPDATE OR DELETE ON commerce.owner_access_quotes
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
CREATE TRIGGER twin_safety_report_immutable
BEFORE UPDATE OR DELETE ON commerce.twin_safety_reports
FOR EACH ROW EXECUTE FUNCTION commerce.reject_twin_immutable_mutation();
