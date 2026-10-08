-- C03 continuation: per-member durable sync checkpoints and safe event retention.
-- Depends on approved C01 0016, C02 0017, C03 0019. Do not apply alone.
-- The C03 journal may contain historical rows; seed a bounded tip, not a
-- fabricated acknowledgment. A cursor is never advanced on an uncommitted write.
CREATE TABLE talks.human_dm_event_checkpoints (
  tenant_id text NOT NULL,
  recipient_user_id text NOT NULL,
  latest_event_id bigint NOT NULL DEFAULT 0 CHECK (latest_event_id >= 0),
  pruned_through_event_id bigint NOT NULL DEFAULT 0 CHECK (pruned_through_event_id >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,recipient_user_id),
  FOREIGN KEY (tenant_id,recipient_user_id)
    REFERENCES identity.users (tenant_id,user_id) ON DELETE CASCADE,
  CHECK (pruned_through_event_id <= latest_event_id)
);
INSERT INTO talks.human_dm_event_checkpoints(
  tenant_id,recipient_user_id,latest_event_id)
SELECT tenant_id,recipient_user_id,max(event_id)
FROM talks.human_dm_events GROUP BY tenant_id,recipient_user_id
ON CONFLICT (tenant_id,recipient_user_id) DO UPDATE
SET latest_event_id=GREATEST(
  talks.human_dm_event_checkpoints.latest_event_id,EXCLUDED.latest_event_id);

-- Preserve the old C03 per-tenant transactional advisory lock. Updating
-- the recipient high-water in the same transaction makes future cursor
-- detection reliable even after all of that member's rows are pruned.
CREATE OR REPLACE FUNCTION talks.emit_human_dm_event(
  p_tenant text, p_conversation uuid, p_kind text,
  p_actor text, p_message uuid DEFAULT NULL, p_sequence bigint DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('masanawa:human-dm-event'),hashtext(p_tenant));
  WITH emitted AS (
    INSERT INTO talks.human_dm_events(
      tenant_id,recipient_user_id,conversation_id,kind,
      actor_user_id,message_id,message_sequence)
    SELECT p_tenant,m.member_id,p_conversation,p_kind,
      p_actor,p_message,p_sequence
    FROM talks.human_dm_conversations c
    CROSS JOIN LATERAL (
      VALUES (c.first_user_id),(c.second_user_id)
    ) AS m(member_id)
    WHERE c.tenant_id=p_tenant AND c.conversation_id=p_conversation
    RETURNING tenant_id,recipient_user_id,event_id
  )
  INSERT INTO talks.human_dm_event_checkpoints(
    tenant_id,recipient_user_id,latest_event_id)
  SELECT tenant_id,recipient_user_id,max(event_id)
  FROM emitted GROUP BY tenant_id,recipient_user_id
  ON CONFLICT (tenant_id,recipient_user_id) DO UPDATE
  SET latest_event_id=GREATEST(
    talks.human_dm_event_checkpoints.latest_event_id,EXCLUDED.latest_event_id),
    updated_at=clock_timestamp();
END;
$$;

-- Operator-only database routine: no HTTP exposure. A C03 worker supplies a
-- tenant, reviewed retention age and bounded batch. Pruning and checkpoint
-- advancement happen atomically under the same advisory lock as emit().
-- Aborted transactions cannot publish a watermark or partially remove rows.
CREATE FUNCTION talks.prune_human_dm_events(
  p_tenant text, p_before timestamptz, p_limit integer DEFAULT 1000
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  deleted_count bigint;
BEGIN
  IF p_tenant IS NULL OR length(p_tenant)=0 OR length(p_tenant)>256
    OR p_before IS NULL OR p_before >= clock_timestamp()-interval '7 days'
    OR p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN
    RAISE EXCEPTION 'unsafe C03 retention request' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtext('masanawa:human-dm-event'),hashtext(p_tenant));
  WITH doomed AS (
    SELECT event_id FROM talks.human_dm_events
    WHERE tenant_id=p_tenant AND created_at<p_before
    ORDER BY event_id LIMIT p_limit FOR UPDATE
  ), removed AS (
    DELETE FROM talks.human_dm_events e USING doomed d
    WHERE e.event_id=d.event_id
    RETURNING e.tenant_id,e.recipient_user_id,e.event_id
  ), watermark AS (
    SELECT tenant_id,recipient_user_id,max(event_id) AS max_removed
    FROM removed GROUP BY tenant_id,recipient_user_id
  ), recorded AS (
    INSERT INTO talks.human_dm_event_checkpoints(
      tenant_id,recipient_user_id,latest_event_id,pruned_through_event_id)
    SELECT tenant_id,recipient_user_id,max_removed,max_removed FROM watermark
    ON CONFLICT (tenant_id,recipient_user_id) DO UPDATE
    SET latest_event_id=GREATEST(
      talks.human_dm_event_checkpoints.latest_event_id,EXCLUDED.latest_event_id),
      pruned_through_event_id=GREATEST(
      talks.human_dm_event_checkpoints.pruned_through_event_id,
      EXCLUDED.pruned_through_event_id),
      updated_at=clock_timestamp()
    RETURNING recipient_user_id
  )
  SELECT count(*) INTO deleted_count FROM removed;
  RETURN deleted_count;
END;
$$;

-- This function must never be granted to public/client roles.
-- Deployment operator must verify the migration role's privileges and the
-- backup/restore/rollout gate before enabling any cron invocation.
