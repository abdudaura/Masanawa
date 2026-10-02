ALTER TABLE events.external_receipts
  ADD COLUMN normalized_payload jsonb;

COMMENT ON COLUMN events.external_receipts.normalized_payload IS
  'Canonical secret-safe normalized provider observation/result payload. Raw provider bodies and credentials must never be stored here.';
