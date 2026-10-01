ALTER TABLE security.approvals
  ADD CONSTRAINT approvals_tenant_operation_fkey
  FOREIGN KEY (tenant_id, operation_id)
  REFERENCES events.operations (tenant_id, operation_id);

COMMENT ON CONSTRAINT approvals_tenant_operation_fkey ON security.approvals IS
  'Approval bindings must reference the exact tenant-scoped consequential Operation they authorize.';
