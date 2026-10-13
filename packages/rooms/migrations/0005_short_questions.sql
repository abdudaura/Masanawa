-- Forward-only admission change: short questions are valid; existing tenant,
-- membership and idempotency protection remain. No paid/ledger DDL changes.
ALTER TABLE rooms.questions DROP CONSTRAINT IF EXISTS questions_body_check;
ALTER TABLE rooms.questions
  ADD CONSTRAINT questions_body_check
  CHECK (length(btrim(body)) BETWEEN 1 AND 2000);
