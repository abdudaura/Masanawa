-- AF15 SOURCE PROPOSAL ONLY. Not installed or migration-numbered.
-- AF00 owns append-only migration allocation and PostgreSQL 18 testing.
-- DO NOT enable worker deletion by installing this schema alone.
-- All existing producers (avatars, DM/room, Talks, financial escrow evidence)
-- MUST transition their link/unlink/hold operations to these fenced rows.
-- Two eligibility attestations default false and are NEVER set by this SQL.

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.media_cleanup_objects (
  tenant_id text NOT NULL,
  object_key text NOT NULL,
  object_version text NULL,
  kind text NOT NULL CHECK (kind IN ('avatar', 'voice_note', 'room_audio', 'audio_post', 'escrow_evidence')),
  created_at timestamptz NOT NULL,
  retain_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'deleting', 'quarantined', 'deleted')),
  immutable boolean NOT NULL DEFAULT false,
  delete_approved boolean NOT NULL DEFAULT false,
  link_guard_installed boolean NOT NULL DEFAULT false,
  domain_refs_reconciled boolean NOT NULL DEFAULT false,
  reference_revision integer NOT NULL DEFAULT 1 CHECK (reference_revision >= 1),
  lease_token text NULL,
  lease_owner text NULL,
  lease_expires_at timestamptz NULL,
  stop_reason text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, object_key),
  CONSTRAINT media_cleanup_lease_shape CHECK (
    status <> 'deleting' OR
    (lease_token IS NOT NULL AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CONSTRAINT media_cleanup_time_order CHECK (retain_until >= created_at)
);

CREATE TABLE IF NOT EXISTS ops.media_cleanup_references (
  tenant_id text NOT NULL,
  object_key text NOT NULL,
  reference_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, object_key, reference_id),
  FOREIGN KEY (tenant_id, object_key)
    REFERENCES ops.media_cleanup_objects (tenant_id, object_key) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS ops.media_cleanup_holds (
  tenant_id text NOT NULL,
  object_key text NOT NULL,
  hold_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, object_key, hold_id),
  FOREIGN KEY (tenant_id, object_key)
    REFERENCES ops.media_cleanup_objects (tenant_id, object_key) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS media_cleanup_pending
  ON ops.media_cleanup_objects (retain_until, tenant_id, object_key)
  WHERE status = 'pending' AND delete_approved IS TRUE;
CREATE INDEX IF NOT EXISTS media_cleanup_active_refs
  ON ops.media_cleanup_references (tenant_id, object_key) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS media_cleanup_active_holds
  ON ops.media_cleanup_holds (tenant_id, object_key) WHERE active IS TRUE;

-- Important: the parent row lock is shared with SKIP LOCKED claims.
-- A new link/hold cannot race a tombstone into eligibility. Changing a link's
-- tenant or object identity is forbidden; create/delete separate rows instead.
CREATE OR REPLACE FUNCTION ops.media_cleanup_guard_link()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t text;
  k text;
  current_status text;
  wanted_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND
     (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.object_key IS DISTINCT FROM NEW.object_key) THEN
    RAISE EXCEPTION 'media_cleanup.reference_identity_immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    t := OLD.tenant_id; k := OLD.object_key; wanted_active := false;
  ELSE
    t := NEW.tenant_id; k := NEW.object_key; wanted_active := NEW.active;
  END IF;

  SELECT status INTO current_status FROM ops.media_cleanup_objects
    WHERE tenant_id = t AND object_key = k FOR UPDATE;
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'media_cleanup.missing_object' USING ERRCODE = '23503';
  END IF;
  IF wanted_active IS TRUE AND current_status <> 'active' THEN
    RAISE EXCEPTION 'media_cleanup.tombstone_link_denied' USING ERRCODE = '23514';
  END IF;
  UPDATE ops.media_cleanup_objects
    SET reference_revision = reference_revision + 1, updated_at = clock_timestamp()
    WHERE tenant_id = t AND object_key = k;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_cleanup_reference_fence ON ops.media_cleanup_references;
CREATE TRIGGER media_cleanup_reference_fence
  BEFORE INSERT OR UPDATE OR DELETE ON ops.media_cleanup_references
  FOR EACH ROW EXECUTE FUNCTION ops.media_cleanup_guard_link();
DROP TRIGGER IF EXISTS media_cleanup_hold_fence ON ops.media_cleanup_holds;
CREATE TRIGGER media_cleanup_hold_fence
  BEFORE INSERT OR UPDATE OR DELETE ON ops.media_cleanup_holds
  FOR EACH ROW EXECUTE FUNCTION ops.media_cleanup_guard_link();

-- SAFETY/OPERATIONS: AF00 must review service grants and block arbitrary
-- runtime writes to delete_approved/link_guard_installed/domain_refs_reconciled.
-- Producers must add these rows and transition active->pending atomically.
-- Any legacy/object-store references not represented here prohibit enabling
-- domain_refs_reconciled; no automatic blanket attestation is valid.
-- Failed/expired deleting leases are quarantined for operator review; NEVER
-- automatically reclaimed while remote delete outcome could be uncertain.
