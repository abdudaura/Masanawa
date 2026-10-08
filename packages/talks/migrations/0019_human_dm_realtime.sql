-- C03: durable metadata-only journal for C02 human DM changes.
-- Requires 0016 contacts + 0017 human DM core (and ordered 0018 media).
-- Never persist message body, previews, tokens or device identifiers here.
CREATE TABLE talks.human_dm_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  recipient_user_id text NOT NULL,
  conversation_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN
    ('message_added','message_changed','message_deleted','read_changed','access_changed')),
  actor_user_id text NOT NULL,
  message_id uuid,
  message_sequence bigint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES
    talks.human_dm_conversations (tenant_id,conversation_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,recipient_user_id) REFERENCES
    identity.users (tenant_id,user_id) ON DELETE CASCADE,
  CHECK (
    ((kind IN ('message_added','message_changed','message_deleted'))
       AND message_id IS NOT NULL AND message_sequence IS NOT NULL)
    OR (kind='read_changed'
       AND message_id IS NULL AND message_sequence IS NOT NULL)
    OR (kind='access_changed'
       AND message_id IS NULL AND message_sequence IS NULL)
  )
);
CREATE INDEX human_dm_events_member_cursor_idx
  ON talks.human_dm_events (tenant_id,recipient_user_id,event_id);
CREATE INDEX human_dm_events_tenant_age_idx
  ON talks.human_dm_events (tenant_id,created_at);

-- A tenant-scoped transaction lock ensures event IDs are allocated in
-- COMMIT order *within a tenant*. Bigserial alone is not commit-ordered:
-- a slow transaction otherwise makes cursor catch-up permanently miss it.
CREATE FUNCTION talks.emit_human_dm_event(
  p_tenant text, p_conversation uuid, p_kind text,
  p_actor text, p_message uuid DEFAULT NULL, p_sequence bigint DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('masanawa:human-dm-event'), hashtext(p_tenant)
  );
  -- Project one scoped row to each real human member. This bounds a user's
  -- cursor scan to their own conversations, not every DM in the tenant.
  INSERT INTO talks.human_dm_events(
    tenant_id,recipient_user_id,conversation_id,kind,
    actor_user_id,message_id,message_sequence
  )
  SELECT p_tenant,m.member_id,p_conversation,p_kind,
    p_actor,p_message,p_sequence
  FROM talks.human_dm_conversations c
  CROSS JOIN LATERAL (
    VALUES (c.first_user_id),(c.second_user_id)
  ) AS m(member_id)
  WHERE c.tenant_id=p_tenant AND c.conversation_id=p_conversation;
END;
$$;

CREATE FUNCTION talks.human_dm_message_event_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM talks.emit_human_dm_event(NEW.tenant_id,NEW.conversation_id,
      'message_added',NEW.sender_user_id,NEW.message_id,NEW.sequence);
  ELSIF NEW.body IS DISTINCT FROM OLD.body OR
        NEW.edited_at IS DISTINCT FROM OLD.edited_at OR
        NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM talks.emit_human_dm_event(NEW.tenant_id,NEW.conversation_id,
      CASE WHEN NEW.deleted_at IS NOT NULL THEN 'message_deleted'
        ELSE 'message_changed' END,
      NEW.sender_user_id,NEW.message_id,NEW.sequence);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER human_dm_event_on_message
AFTER INSERT OR UPDATE ON talks.human_dm_messages
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_message_event_trigger();

CREATE FUNCTION talks.human_dm_read_event_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.last_read_sequence IS DISTINCT FROM OLD.last_read_sequence THEN
    PERFORM talks.emit_human_dm_event(NEW.tenant_id,NEW.conversation_id,
      'read_changed',NEW.user_id,NULL,NEW.last_read_sequence);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER human_dm_event_on_read
AFTER INSERT OR UPDATE ON talks.human_dm_reads
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_read_event_trigger();

-- Privacy changes produce only opaque "access_changed" invalidations.
-- These must be delivered even to formerly permitted members so a phone
-- can purge any cached projection and recheck fresh C02 permissions.
CREATE FUNCTION talks.human_dm_contact_event_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE thread_id uuid;
BEGIN
  SELECT conversation_id INTO thread_id FROM talks.human_dm_conversations
   WHERE tenant_id=NEW.tenant_id
     AND first_user_id=NEW.first_user_id AND second_user_id=NEW.second_user_id;
  IF thread_id IS NOT NULL AND
      (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM talks.emit_human_dm_event(NEW.tenant_id,thread_id,
      'access_changed',NEW.requested_by);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER human_dm_event_on_contact
AFTER INSERT OR UPDATE ON talks.human_dm_contact_requests
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_contact_event_trigger();

CREATE FUNCTION talks.human_dm_user_access_event_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE thread RECORD;
DECLARE actor text;
BEGIN
  IF TG_TABLE_NAME='human_dm_preferences' THEN
    IF TG_OP='UPDATE' AND NEW.admission_policy IS NOT DISTINCT FROM OLD.admission_policy
       AND NEW.discoverable_by_handle IS NOT DISTINCT FROM OLD.discoverable_by_handle THEN
      RETURN NULL;
    END IF;
    actor := NEW.user_id;
  ELSIF TG_TABLE_NAME='safety_preferences' THEN
    IF TG_OP='UPDATE' AND NEW.blocked IS NOT DISTINCT FROM OLD.blocked THEN
      RETURN NULL;
    END IF;
    actor := NEW.viewer_user_id;
  ELSE
    IF TG_OP='UPDATE' AND NEW.state IS NOT DISTINCT FROM OLD.state THEN
      RETURN NULL;
    END IF;
    actor := NEW.user_id;
  END IF;
  IF TG_TABLE_NAME='safety_preferences' THEN
    FOR thread IN
      SELECT conversation_id FROM talks.human_dm_conversations
       WHERE tenant_id=NEW.tenant_id
         AND ((first_user_id=NEW.viewer_user_id AND second_user_id=NEW.subject_user_id)
           OR (second_user_id=NEW.viewer_user_id AND first_user_id=NEW.subject_user_id))
    LOOP
      PERFORM talks.emit_human_dm_event(
        NEW.tenant_id,thread.conversation_id,'access_changed',actor);
    END LOOP;
  ELSE
    FOR thread IN
      SELECT conversation_id FROM talks.human_dm_conversations
       WHERE tenant_id=NEW.tenant_id
         AND (first_user_id=actor OR second_user_id=actor)
    LOOP
      PERFORM talks.emit_human_dm_event(
        NEW.tenant_id,thread.conversation_id,'access_changed',actor);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER human_dm_event_on_preference
AFTER INSERT OR UPDATE ON talks.human_dm_preferences
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_user_access_event_trigger();
CREATE TRIGGER human_dm_event_on_block
AFTER INSERT OR UPDATE ON talks.safety_preferences
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_user_access_event_trigger();
CREATE TRIGGER human_dm_event_on_account
AFTER UPDATE ON identity.users
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_user_access_event_trigger();

-- A profile safety enforcement change invalidates all the profile owner's
-- human DMs, not AI personas or public Talk feeds.
CREATE FUNCTION talks.human_dm_profile_enforcement_event_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE profile_user text;
DECLARE thread RECORD;
BEGIN
  IF NEW.target_kind <> 'profile' THEN RETURN NULL; END IF;
  SELECT user_id INTO profile_user FROM talks.public_profiles
    WHERE tenant_id=NEW.tenant_id AND handle=NEW.target_id;
  IF profile_user IS NULL THEN RETURN NULL; END IF;
  FOR thread IN SELECT conversation_id FROM talks.human_dm_conversations
    WHERE tenant_id=NEW.tenant_id
      AND (first_user_id=profile_user OR second_user_id=profile_user)
  LOOP
    PERFORM talks.emit_human_dm_event(
      NEW.tenant_id,thread.conversation_id,'access_changed',profile_user);
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER human_dm_event_on_profile_restriction
AFTER INSERT OR UPDATE ON talks.safety_enforcement
FOR EACH ROW EXECUTE FUNCTION talks.human_dm_profile_enforcement_event_trigger();

-- No journal purge or automatic retention runs yet: the shared operations
-- owner must add a watermark-aware trim/recovery worker before production.
-- Never silently delete events without a cursor-expiry/reset contract.
