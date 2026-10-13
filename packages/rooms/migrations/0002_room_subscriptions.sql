-- J08 Play-first plans and entitlements; append-only, never modify 0001 or legacy finance.
-- Activation is gated by AF00 until a verified Play API, RTDN, device and staging restore.
CREATE TABLE rooms.plans (
 tenant_id text NOT NULL, plan_id text NOT NULL CHECK (plan_id ~ '^room-plan_'),
 room_id text NOT NULL, period text NOT NULL CHECK (period IN ('month','year')),
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','retired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,plan_id),
 UNIQUE (tenant_id,room_id,period),
 FOREIGN KEY (tenant_id,room_id) REFERENCES rooms.rooms(tenant_id,room_id)
);
CREATE TABLE rooms.price_versions (
 tenant_id text NOT NULL, plan_id text NOT NULL, version integer NOT NULL CHECK (version>0),
 amount_minor bigint NOT NULL CHECK (amount_minor>0),
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 store_product_id text NOT NULL CHECK (length(store_product_id) BETWEEN 3 AND 180),
 effective_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,plan_id,version),
 UNIQUE (tenant_id,store_product_id,version),
 FOREIGN KEY (tenant_id,plan_id) REFERENCES rooms.plans(tenant_id,plan_id)
);
CREATE INDEX room_price_effective_idx ON rooms.price_versions(tenant_id,plan_id,effective_at DESC,version DESC);
-- Immutable accepted prices remain in place; no UPDATE/DELETE capability in the domain repository.
CREATE TABLE rooms.entitlements (
 tenant_id text NOT NULL, user_id text NOT NULL, room_id text NOT NULL,
 plan_id text NOT NULL, price_version integer NOT NULL,
 state text NOT NULL CHECK (state IN ('active','grace','on_hold','past_due','expired','cancelled','refunded')),
 period_end timestamptz NOT NULL,
 store_purchase_token_hash text NOT NULL CHECK (store_purchase_token_hash ~ '^[0-9a-f]{64}$'),
 store_order_ref text, last_verified_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,user_id,room_id),
 UNIQUE(store_purchase_token_hash),
 FOREIGN KEY (tenant_id,room_id) REFERENCES rooms.rooms(tenant_id,room_id),
 FOREIGN KEY (tenant_id,user_id) REFERENCES identity.users(tenant_id,user_id),
 FOREIGN KEY (tenant_id,plan_id,price_version) REFERENCES rooms.price_versions(tenant_id,plan_id,version)
);
CREATE INDEX room_entitlement_guard_idx ON rooms.entitlements(tenant_id,room_id,user_id,period_end)
 WHERE state IN ('active','grace');
CREATE TABLE rooms.store_notifications (
 tenant_id text NOT NULL, notification_id text NOT NULL,
 token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 80),
 result text NOT NULL CHECK (result IN ('linked','unlinked','duplicate','denied')),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,notification_id)
);
CREATE INDEX room_store_token_idx ON rooms.store_notifications(tenant_id,token_hash,received_at DESC);
-- No raw Play tokens, bank identifiers, fiat wallet or provider secrets persisted.

