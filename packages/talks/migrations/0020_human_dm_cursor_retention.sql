-- C03: lossless resnapshot fencing for bounded human DM event retention.
-- Runs ONLY after 0019_human_dm_realtime.sql and accepted C01/C02 migrations.
-- This is an operator-invoked primitive, NOT an automatically scheduled purge.
CREATE TABLE talks.human_dm_event_watermarks (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  trimmed_through_id bigint NOT NULL DEFAULT 0 CHECK (trimmed_through_id >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES identity.users(tenant_id,user_id) ON DELETE CASCADE
);

-- Serialize with talks.emit_human_dm_event: a concurrent insert cannot be
-- allocated "behind" a journal prune or silently skipped by an old cursor.
-- Only the migration/DB owner can invoke the function; no HTTP/user endpoint.
CREATE FUNCTION talks.trim_human_dm_events(
  p_tenant text, p_before timestamptz, p_limit integer DEFAULT 1000
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed_count integer;
BEGIN
  IF p_tenant IS NULL OR length(p_tenant)=0 OR
     p_before IS NULL OR p_before >= clock_timestamp() - interval '1 hour' OR
     p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'invalid scoped human DM retention parameters'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtext('masanawa:human-dm-event'),hashtext(p_tenant)
  );

  -- The candidate set is one global tenant event-ID prefix, bounded by the
  -- operator-supplied time cutoff. Checkpoint and deletion are ONE transaction:
  -- a process crash can leave neither or both, never silent cursor holes.
  WITH chosen AS MATERIALIZED (
    SELECT event_id, recipient_user_id
    FROM talks.human_dm_events
    WHERE tenant_id=p_tenant AND created_at < p_before
      -- Never trim past any still-protected event, even if wall-clock time
      -- regressed and timestamps are not ordered like event IDs.
      AND event_id < COALESCE((
        SELECT min(event_id) FROM talks.human_dm_events
        WHERE tenant_id=p_tenant AND created_at >= p_before
      ),9223372036854775807::bigint)
    ORDER BY event_id ASC LIMIT p_limit
    FOR UPDATE
  ), highs AS (
    SELECT recipient_user_id, max(event_id) AS last_id
    FROM chosen GROUP BY recipient_user_id
  ), checkpoints AS (
    INSERT INTO talks.human_dm_event_watermarks
      (tenant_id,user_id,trimmed_through_id)
    SELECT p_tenant,recipient_user_id,last_id FROM highs
    ON CONFLICT (tenant_id,user_id) DO UPDATE SET
      trimmed_through_id=GREATEST(
        talks.human_dm_event_watermarks.trimmed_through_id,
        EXCLUDED.trimmed_through_id),
      updated_at=clock_timestamp()
    RETURNING user_id
  ), deleted AS (
    DELETE FROM talks.human_dm_events e USING chosen c
    WHERE e.tenant_id=p_tenant AND e.event_id=c.event_id
      AND EXISTS(SELECT 1 FROM checkpoints)
    RETURNING e.event_id
  )
  SELECT count(*)::integer INTO removed_count FROM deleted;
  RETURN removed_count;
END
$$;

REVOKE ALL ON FUNCTION talks.trim_human_dm_events(text,timestamptz,integer)
  FROM PUBLIC;
COMMENT ON FUNCTION talks.trim_human_dm_events(text,timestamptz,integer)
  IS 'Privileged, bounded retention. Requires C03 checkpoint-aware clients and a C02 full-snapshot recovery; run in reviewed operator transaction, never against unknown schema.';
