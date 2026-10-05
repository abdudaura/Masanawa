CREATE OR REPLACE FUNCTION workflows.guard_workflow_run_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WorkflowRun history cannot be destructively deleted'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.workflow_run_id IS DISTINCT FROM OLD.workflow_run_id
     OR NEW.workflow_version_id IS DISTINCT FROM OLD.workflow_version_id
     OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.revision <> OLD.revision + 1
     OR NEW.checkpoint_revision < OLD.checkpoint_revision
     OR NEW.checkpoint_revision > OLD.checkpoint_revision + 1
     OR NEW.updated_at < OLD.updated_at
     OR OLD.state IN ('completed','failed','cancelled')
     OR (
       NEW.state IS DISTINCT FROM OLD.state
       AND NOT (
         (OLD.state = 'queued' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'running' AND NEW.state IN (
           'waiting_approval','waiting_external','completed','failed','cancelled'
         ))
         OR
         (OLD.state = 'waiting_approval' AND NEW.state IN ('running','failed','cancelled'))
         OR
         (OLD.state = 'waiting_external' AND NEW.state IN (
           'running','completed','failed','cancelled'
         ))
       )
     ) THEN
    RAISE EXCEPTION 'WorkflowRun identity/history is immutable and updates require a legal active revision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
