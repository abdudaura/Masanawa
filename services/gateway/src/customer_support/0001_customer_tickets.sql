
-- U29, not in the global migration manifest: integrate only through F11 migration ownership.
-- No application role may mutate resolved/refunded financial domain state through these tables.
BEGIN;
CREATE SCHEMA IF NOT EXISTS support;
CREATE TABLE IF NOT EXISTS support.customer_tickets (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  id UUID NOT NULL,
  request_key UUID NOT NULL,
  request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  kind TEXT NOT NULL CHECK (kind IN ('general', 'billing_quote', 'crypto_intent')),
  operation_ref TEXT,
  reference_mask TEXT,
  operation_phase TEXT CHECK (operation_phase IN ('pending','succeeded','failed','refunded','unknown')),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 1000),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','reviewing','resolved','closed')),
  resolution TEXT,
  consented_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, user_id, request_key),
  CHECK ((kind='general' AND operation_ref IS NULL AND operation_phase IS NULL)
     OR (kind <> 'general' AND operation_ref IS NOT NULL AND operation_phase IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_support_customer_tickets_history
  ON support.customer_tickets(tenant_id, user_id, created_at DESC, id DESC);
-- This is a queue for human triage, not a claim that an email/webhook has been delivered.
CREATE INDEX IF NOT EXISTS idx_support_customer_tickets_queue
  ON support.customer_tickets(tenant_id, created_at ASC, id ASC) WHERE status IN ('queued','reviewing');
COMMIT;
