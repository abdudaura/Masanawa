-- C06: durable, user-initiated internal crypto quote evidence.
CREATE TABLE IF NOT EXISTS commerce.crypto_internal_transfer_quotes (
 tenant_id text NOT NULL,
 sender_user_id text NOT NULL,
 request_id text NOT NULL,
 recipient_user_id text NOT NULL,
 asset text NOT NULL,
 network text,
 amount numeric(38,18) NOT NULL CHECK (amount > 0),
 approval_hash text NOT NULL CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','completed','expired','rejected')),
 recipient_request_id text,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id, sender_user_id, request_id),
 FOREIGN KEY (tenant_id,sender_user_id) REFERENCES identity.users(tenant_id,user_id),
 FOREIGN KEY (tenant_id,recipient_user_id) REFERENCES identity.users(tenant_id,user_id),
 CHECK (sender_user_id <> recipient_user_id),
 CHECK ((status='completed')=(completed_at IS NOT NULL))
);