-- A05/A06 editorial review. Forward only: retain published posts, media, likes,
-- comments and all prior financial/identity records.
ALTER TABLE feed.posts DROP CONSTRAINT IF EXISTS posts_state_check;
ALTER TABLE feed.posts ADD CONSTRAINT posts_state_check
 CHECK (state IN ('draft','in_review','scheduled','published','hidden','removed'));
ALTER TABLE feed.posts ADD COLUMN IF NOT EXISTS review_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE feed.posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE feed.posts ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE feed.posts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE feed.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE feed.posts ADD CONSTRAINT feed_schedule_state_consistency
 CHECK ((state='scheduled' AND scheduled_at IS NOT NULL) OR state<>'scheduled');
CREATE INDEX IF NOT EXISTS feed_scheduled_due
 ON feed.posts(tenant_id,scheduled_at,id) WHERE state='scheduled';
CREATE INDEX IF NOT EXISTS feed_staff_review
 ON feed.posts(tenant_id,state,updated_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS feed.editorial_events (
 tenant_id text NOT NULL,
 event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL,
 revision bigint NOT NULL,
 previous_state text,
 next_state text NOT NULL,
 actor_id text NOT NULL,
 action text NOT NULL,
 idempotency_key text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,event_id),
 UNIQUE(tenant_id,post_id,revision),
 UNIQUE(tenant_id,actor_id,idempotency_key),
 FOREIGN KEY (tenant_id,post_id) REFERENCES feed.posts(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS feed_editorial_post_events
 ON feed.editorial_events(tenant_id,post_id,revision DESC);
