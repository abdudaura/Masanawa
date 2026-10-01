ALTER TABLE world.worlds
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN recovery_target_time timestamptz;

UPDATE world.worlds
   SET paused_at = updated_at
 WHERE status = 'paused'
   AND paused_at IS NULL;

ALTER TABLE world.worlds
  ADD CONSTRAINT worlds_pause_metadata_consistent
  CHECK (
    (status = 'paused' AND paused_at IS NOT NULL)
    OR
    (status <> 'paused' AND paused_at IS NULL)
  ),
  ADD CONSTRAINT worlds_recovery_target_only_while_paused
  CHECK (
    recovery_target_time IS NULL
    OR status = 'paused'
  ),
  ADD CONSTRAINT worlds_recovery_target_not_before_simulation
  CHECK (
    recovery_target_time IS NULL
    OR recovery_target_time >= simulation_time
  );

CREATE INDEX world_paused_recovery_idx
  ON world.worlds(tenant_id, status, recovery_target_time)
  WHERE status = 'paused';
