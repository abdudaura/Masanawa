-- C22: one-level public replies, reusing feed.comments and the existing moderated outbox.
-- Forward only. Historical comments keep NULL parent; no financial or user data removed.
ALTER TABLE feed.comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS feed_comments_parent_ref
  ON feed.comments (tenant_id, post_id, id);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_comments_same_post_parent' AND conrelid='feed.comments'::regclass) THEN
  ALTER TABLE feed.comments ADD CONSTRAINT feed_comments_same_post_parent
   FOREIGN KEY (tenant_id,post_id,parent_comment_id)
   REFERENCES feed.comments (tenant_id,post_id,id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS feed_comments_replies
 ON feed.comments (tenant_id,post_id,parent_comment_id,created_at,id);
