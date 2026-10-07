ALTER TABLE security.customer_channel_messages
  DROP CONSTRAINT IF EXISTS customer_channel_messages_state_check;

ALTER TABLE security.customer_channel_messages
  ADD CONSTRAINT customer_channel_messages_state_check
  CHECK (state IN ('processing','completed','delivered','failed'));
