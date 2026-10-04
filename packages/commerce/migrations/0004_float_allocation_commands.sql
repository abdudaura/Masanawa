CREATE TABLE commerce.agent_float_allocations (
  tenant_id text NOT NULL,
  user_id text NOT NULL CHECK (user_id ~ '^user_'),
  request_id text NOT NULL CHECK (request_id ~ '^request_'),
  character_id text NOT NULL CHECK (character_id ~ '^character_'),
  amount_credits bigint NOT NULL CHECK (amount_credits BETWEEN 1 AND 1000000000),
  ledger_entry_id text NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, request_id),
  UNIQUE (tenant_id, ledger_entry_id),
  FOREIGN KEY (tenant_id, ledger_entry_id)
    REFERENCES commerce.ledger_entries(tenant_id, ledger_entry_id),
  CHECK (definition ->> 'schemaVersion' IS NOT DISTINCT FROM '1'),
  CHECK (definition ->> 'tenantId' IS NOT DISTINCT FROM tenant_id),
  CHECK (definition ->> 'userId' IS NOT DISTINCT FROM user_id),
  CHECK (definition ->> 'requestId' IS NOT DISTINCT FROM request_id),
  CHECK (definition ->> 'characterId' IS NOT DISTINCT FROM character_id),
  CHECK ((definition ->> 'amountCredits')::bigint IS NOT DISTINCT FROM amount_credits),
  CHECK (definition ->> 'ledgerEntryId' IS NOT DISTINCT FROM ledger_entry_id),
  CHECK ((definition ->> 'createdAt')::timestamptz IS NOT DISTINCT FROM created_at)
);

-- Bounded history queries preserve tenant/user scope and use stable keyset order.
CREATE INDEX agent_float_allocation_history_idx ON commerce.agent_float_allocations
  (tenant_id,user_id,created_at DESC,request_id DESC);
CREATE INDEX agent_float_allocation_character_history_idx ON commerce.agent_float_allocations
  (tenant_id,user_id,character_id,created_at DESC,request_id DESC);

-- A receipt must prove this exact custody movement, not merely reference any
-- existing ledger row. Ledger rows are immutable, so this binding stays valid.
CREATE FUNCTION commerce.validate_agent_float_allocation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM commerce.ledger_entries AS entry
    WHERE entry.tenant_id = NEW.tenant_id
      AND entry.ledger_entry_id = NEW.ledger_entry_id
      AND entry.debit_kind = 'customer-credit'
      AND entry.debit_user_id = NEW.user_id
      AND entry.debit_character_id IS NULL
      AND entry.credit_kind = 'agent-float'
      AND entry.credit_user_id = NEW.user_id
      AND entry.credit_character_id = NEW.character_id
      AND entry.amount_credits = NEW.amount_credits
      AND entry.reason = 'agent-float-topup'
      AND entry.quote_id IS NULL
      AND entry.fulfillment_id IS NULL
      AND entry.created_at = NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Float allocation receipt does not match ledger custody'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_float_allocation_custody
BEFORE INSERT ON commerce.agent_float_allocations
FOR EACH ROW EXECUTE FUNCTION commerce.validate_agent_float_allocation();

CREATE TRIGGER agent_float_allocation_immutable
BEFORE UPDATE OR DELETE ON commerce.agent_float_allocations
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();
