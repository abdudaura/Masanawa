-- Applied after commerce schema creation by the canonical owner-sorted runner.
ALTER TABLE commerce.crypto_internal_transfer_quotes
 ADD CONSTRAINT crypto_transfer_sender_user_fk
 FOREIGN KEY (tenant_id,sender_user_id)
 REFERENCES identity.users(tenant_id,user_id) ON DELETE RESTRICT;
ALTER TABLE commerce.crypto_internal_transfer_quotes
 ADD CONSTRAINT crypto_transfer_recipient_user_fk
 FOREIGN KEY (tenant_id,recipient_user_id)
 REFERENCES identity.users(tenant_id,user_id) ON DELETE RESTRICT;
