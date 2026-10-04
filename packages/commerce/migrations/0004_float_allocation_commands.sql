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

CREATE TRIGGER agent_float_allocation_immutable
BEFORE UPDATE OR DELETE ON commerce.agent_float_allocations
FOR EACH ROW EXECUTE FUNCTION commerce.reject_immutable_mutation();
