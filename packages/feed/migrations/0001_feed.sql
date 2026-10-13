-- Forward-only; do not touch historical wallets or legacy media objects.
CREATE SCHEMA IF NOT EXISTS feed;
CREATE TABLE IF NOT EXISTS feed.posts (
 tenant_id text NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),author_masana_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('text','image','audio')),body text NOT NULL,media_ids text[] NOT NULL DEFAULT '{}',
 transcript text, state text NOT NULL DEFAULT 'published' CHECK(state IN ('published','hidden','removed')),
 idempotency_key text NOT NULL,published_by text NOT NULL,published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,published_by,idempotency_key),CHECK(length(body)<=5000),CHECK(cardinality(media_ids)<=10));
CREATE INDEX IF NOT EXISTS feed_posts_recent ON feed.posts(tenant_id,published_at DESC,id DESC) WHERE state='published';
CREATE TABLE IF NOT EXISTS feed.likes (
 tenant_id text NOT NULL,post_id uuid NOT NULL,fan_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,post_id,fan_id),FOREIGN KEY(tenant_id,post_id) REFERENCES feed.posts(tenant_id,id));
CREATE TABLE IF NOT EXISTS feed.saves (
 tenant_id text NOT NULL,post_id uuid NOT NULL,fan_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,post_id,fan_id),FOREIGN KEY(tenant_id,post_id) REFERENCES feed.posts(tenant_id,id));
CREATE TABLE IF NOT EXISTS feed.comments (
 tenant_id text NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),post_id uuid NOT NULL,fan_id text NOT NULL,
 body text NOT NULL,state text NOT NULL CHECK(state IN ('pending','visible','hidden','removed')),
 idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,fan_id,idempotency_key),
 FOREIGN KEY(tenant_id,post_id) REFERENCES feed.posts(tenant_id,id),CHECK(length(body) BETWEEN 1 AND 1000));
CREATE INDEX IF NOT EXISTS feed_comments_thread ON feed.comments(tenant_id,post_id,created_at DESC,id DESC);
-- Follow association is canonical in L-MASANA; no second follow store is created here.
