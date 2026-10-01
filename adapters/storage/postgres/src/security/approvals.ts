import {
  PlatformError,
  type ApprovalId,
  type AuthorityContextId,
  type Instant,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";
import {
  assertApprovalMatches,
  type ApprovalBinding,
  type ApprovalKind,
  type ApprovalRecord,
  type ApprovalState,
  type AuthorityContext,
  type CurrentAuthoritySource,
} from "@masanawa/security";
import type { PoolClient } from "pg";

interface ApprovalRow {
  approval_id: ApprovalId;
  tenant_id: TenantId;
  operation_id: OperationId;
  kind: ApprovalKind;
  state: ApprovalState;
  principal_key: string;
  action: string;
  action_version: string;
  resource_key: string;
  arguments_fingerprint: string;
  risk_class: string;
  policy_revision: string;
  requested_at: Date;
  expires_at: Date;
  decided_at: Date | null;
  approver_key: string | null;
}

function toApprovalRecord(row: ApprovalRow): ApprovalRecord {
  const binding: ApprovalBinding = Object.freeze({
    operationId: row.operation_id,
    tenantId: row.tenant_id,
    principalKey: row.principal_key,
    action: row.action,
    actionVersion: row.action_version,
    resourceKey: row.resource_key,
    argumentsFingerprint: row.arguments_fingerprint,
    riskClass: row.risk_class,
  });

  return Object.freeze({
    approvalId: row.approval_id,
    kind: row.kind,
    state: row.state,
    binding,
    policyRevision: row.policy_revision,
    requestedAt: row.requested_at.toISOString() as Instant,
    expiresAt: row.expires_at.toISOString() as Instant,
    ...(row.decided_at ? { decidedAt: row.decided_at.toISOString() as Instant } : {}),
    ...(row.approver_key ? { approverKey: row.approver_key } : {}),
  });
}

function requireNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new TypeError(`${name} is required`);
  }
}

export async function setPolicyRevision(
  client: PoolClient,
  tenantId: TenantId,
  revision: string,
): Promise<void> {
  requireNonEmpty(revision, "revision");
  await client.query(
    `INSERT INTO security.policy_state (tenant_id, revision)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id)
     DO UPDATE SET revision = EXCLUDED.revision,
                   updated_at = clock_timestamp()`,
    [tenantId, revision],
  );
}

export async function getPolicyRevision(
  client: PoolClient,
  tenantId: TenantId,
): Promise<string> {
  const result = await client.query<{ revision: string }>(
    `SELECT revision FROM security.policy_state WHERE tenant_id = $1`,
    [tenantId],
  );
  const revision = result.rows[0]?.revision;
  if (!revision) {
    throw new PlatformError({
      code: "authority.policy_unavailable",
      category: "authorization",
      message: "Current policy revision is unavailable",
      retryable: false,
    });
  }
  return revision;
}

export async function revokeAuthorityContext(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly authorityContextId: AuthorityContextId;
    readonly reasonCode: string;
  },
): Promise<void> {
  requireNonEmpty(input.reasonCode, "reasonCode");
  await client.query(
    `INSERT INTO security.authority_revocations (
       tenant_id, authority_context_id, reason_code
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, authority_context_id)
     DO NOTHING`,
    [input.tenantId, input.authorityContextId, input.reasonCode],
  );
}

export async function isAuthorityContextRevoked(
  client: PoolClient,
  tenantId: TenantId,
  authorityContextId: AuthorityContextId,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
       FROM security.authority_revocations
      WHERE tenant_id = $1 AND authority_context_id = $2`,
    [tenantId, authorityContextId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function persistPendingApproval(
  client: PoolClient,
  approval: ApprovalRecord,
): Promise<ApprovalRecord> {
  if (approval.state !== "pending") {
    throw new PlatformError({
      code: "approval.invalid_initial_state",
      category: "conflict",
      message: "Only pending approvals may be created",
      retryable: false,
    });
  }

  const result = await client.query<ApprovalRow>(
    `INSERT INTO security.approvals (
       approval_id,
       tenant_id,
       operation_id,
       kind,
       state,
       principal_key,
       action,
       action_version,
       resource_key,
       arguments_fingerprint,
       risk_class,
       policy_revision,
       requested_at,
       expires_at
     )
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING approval_id,
               tenant_id,
               operation_id,
               kind,
               state,
               principal_key,
               action,
               action_version,
               resource_key,
               arguments_fingerprint,
               risk_class,
               policy_revision,
               requested_at,
               expires_at,
               decided_at,
               approver_key`,
    [
      approval.approvalId,
      approval.binding.tenantId,
      approval.binding.operationId,
      approval.kind,
      approval.binding.principalKey,
      approval.binding.action,
      approval.binding.actionVersion,
      approval.binding.resourceKey,
      approval.binding.argumentsFingerprint,
      approval.binding.riskClass,
      approval.policyRevision,
      approval.requestedAt,
      approval.expiresAt,
    ],
  );
  return toApprovalRecord(result.rows[0]!);
}

export async function loadApproval(
  client: PoolClient,
  tenantId: TenantId,
  approvalId: ApprovalId,
  forUpdate = false,
): Promise<ApprovalRecord> {
  const result = await client.query<ApprovalRow>(
    `SELECT approval_id,
            tenant_id,
            operation_id,
            kind,
            state,
            principal_key,
            action,
            action_version,
            resource_key,
            arguments_fingerprint,
            risk_class,
            policy_revision,
            requested_at,
            expires_at,
            decided_at,
            approver_key
       FROM security.approvals
      WHERE tenant_id = $1 AND approval_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, approvalId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "approval.not_found",
      category: "not-found",
      message: "Approval does not exist in the requested tenant",
      retryable: false,
    });
  }
  return toApprovalRecord(row);
}

export async function settlePendingApproval(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly approvalId: ApprovalId;
    readonly decision: "approved" | "denied";
    readonly approverKey: string;
    readonly decidedAt: Instant;
  },
): Promise<ApprovalRecord> {
  requireNonEmpty(input.approverKey, "approverKey");

  const result = await client.query<ApprovalRow>(
    `UPDATE security.approvals
        SET state = $3,
            decided_at = $4,
            approver_key = $5,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND approval_id = $2
        AND state = 'pending'
        AND expires_at > $4::timestamptz
      RETURNING approval_id,
                tenant_id,
                operation_id,
                kind,
                state,
                principal_key,
                action,
                action_version,
                resource_key,
                arguments_fingerprint,
                risk_class,
                policy_revision,
                requested_at,
                expires_at,
                decided_at,
                approver_key`,
    [
      input.tenantId,
      input.approvalId,
      input.decision,
      input.decidedAt,
      input.approverKey,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "approval.stale_decision",
      category: "conflict",
      message: "Approval is no longer pending and unexpired",
      retryable: false,
    });
  }
  return toApprovalRecord(row);
}

export async function consumeOnceApproval(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly approvalId: ApprovalId;
    readonly binding: ApprovalBinding;
    readonly currentPolicyRevision: string;
    readonly consumedAt: Instant;
  },
): Promise<ApprovalRecord> {
  requireNonEmpty(input.currentPolicyRevision, "currentPolicyRevision");

  const approval = await loadApproval(
    client,
    input.tenantId,
    input.approvalId,
    true,
  );
  assertApprovalMatches(approval, input.binding, input.consumedAt);

  if (approval.kind !== "once") {
    throw new PlatformError({
      code: "approval.not_once",
      category: "conflict",
      message: "Approval is not an allow-once approval",
      retryable: false,
    });
  }
  if (approval.policyRevision !== input.currentPolicyRevision) {
    throw new PlatformError({
      code: "approval.stale_policy",
      category: "authorization",
      message: "Approval was granted under a stale policy revision",
      retryable: false,
      details: {
        approvedRevision: approval.policyRevision,
        currentRevision: input.currentPolicyRevision,
      },
    });
  }

  const currentRevision = await getPolicyRevision(client, input.tenantId);
  if (currentRevision !== input.currentPolicyRevision) {
    throw new PlatformError({
      code: "approval.policy_changed",
      category: "authorization",
      message: "Current policy changed before approval consumption",
      retryable: false,
      details: {
        assertedRevision: input.currentPolicyRevision,
        currentRevision,
      },
    });
  }

  const result = await client.query<ApprovalRow>(
    `UPDATE security.approvals
        SET state = 'consumed',
            consumed_at = $3,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND approval_id = $2
        AND state = 'approved'
        AND kind = 'once'
        AND expires_at > $3::timestamptz
      RETURNING approval_id,
                tenant_id,
                operation_id,
                kind,
                state,
                principal_key,
                action,
                action_version,
                resource_key,
                arguments_fingerprint,
                risk_class,
                policy_revision,
                requested_at,
                expires_at,
                decided_at,
                approver_key`,
    [input.tenantId, input.approvalId, input.consumedAt],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "approval.already_consumed",
      category: "conflict",
      message: "Allow-once approval was already consumed or became unusable",
      retryable: false,
    });
  }
  return toApprovalRecord(row);
}


export function createPostgresCurrentAuthoritySource(
  client: PoolClient,
): CurrentAuthoritySource {
  return {
    getPolicyRevision: (tenantId) => getPolicyRevision(client, tenantId),
    isRevoked: (context: AuthorityContext) =>
      isAuthorityContextRevoked(
        client,
        context.tenantId,
        context.authorityContextId,
      ),
  };
}
