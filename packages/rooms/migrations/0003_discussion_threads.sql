-- C39: extend existing durable discussion table; forward-only, preserves all old rows.
-- AF00 registers this after 0001 and 0002; NEVER apply to a shared DB from a lane.
ALTER TABLE rooms.discussion_replies
  ADD COLUMN lesson_id text,
  ADD COLUMN parent_reply_id text,
  ADD COLUMN idempotency_key text,
  ADD COLUMN reviewed_by text,
  ADD COLUMN reviewed_at timestamptz;
ALTER TABLE rooms.discussion_replies ALTER COLUMN question_id DROP NOT NULL;
ALTER TABLE rooms.discussion_replies
  ADD CONSTRAINT room_discussion_single_parent CHECK (
    (question_id IS NOT NULL) <> (lesson_id IS NOT NULL)
  ),
  ADD CONSTRAINT room_discussion_lesson_fk FOREIGN KEY (tenant_id,lesson_id)
    REFERENCES rooms.lessons(tenant_id,lesson_id),
  ADD CONSTRAINT room_discussion_thread_fk FOREIGN KEY (tenant_id,parent_reply_id)
    REFERENCES rooms.discussion_replies(tenant_id,reply_id);
CREATE UNIQUE INDEX room_discussion_replay_uq
  ON rooms.discussion_replies(tenant_id,room_id,user_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX room_discussion_parent_question_idx
  ON rooms.discussion_replies(tenant_id,room_id,question_id,created_at DESC,reply_id DESC)
  WHERE moderation_state='visible';
CREATE INDEX room_discussion_parent_lesson_idx
  ON rooms.discussion_replies(tenant_id,room_id,lesson_id,created_at DESC,reply_id DESC)
  WHERE moderation_state='visible';
CREATE INDEX room_discussion_staff_queue_idx
  ON rooms.discussion_replies(tenant_id,moderation_state,created_at,reply_id)
  WHERE moderation_state='held';
