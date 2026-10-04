import type { TenantId } from "@masanawa/contracts";
import type { AgentAdminAuthorizer } from "./agent_admin.js";
import type { PlatformAdminQuery } from "./platform_admin.js";

export interface SystemAdminSnapshot {
  readonly memory: {
    readonly totalRecords: number;
    readonly activeRecords: number;
    readonly tombstonedRecords: number;
    readonly extractionQueued: number;
    readonly extractionProcessing: number;
    readonly extractionRetryScheduled: number;
    readonly extractionDeadLetter: number;
  };
  readonly queues: {
    readonly outboxPending: number;
    readonly outboxRetryScheduled: number;
    readonly outboxDeadLetter: number;
    readonly inboxAdmitted: number;
    readonly inboxProcessing: number;
    readonly inboxFailed: number;
    readonly inboxDeadLetter: number;
  };
}

export interface SystemAdminWorld {
  readonly worldId: string;
  readonly status: "active" | "paused" | "stopped";
  readonly policyRevision: number;
  readonly currentGenerationNumber: number;
  readonly simulationTime: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface SystemAdminApproval {
  readonly approvalId: string;
  readonly operationId: string;
  readonly kind: string;
  readonly state: string;
  readonly action: string;
  readonly actionVersion: string;
  readonly resourceKey: string;
  readonly riskClass: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly decidedAt: string | null;
  readonly approverKey: string | null;
}


export interface SystemAdminMemoryJob {
  readonly memoryExtractionId: string;
  readonly state: string;
  readonly scopeKind: string;
  readonly sourceKind: string;
  readonly extractorKey: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly safeErrorCode: string | null;
  readonly updatedAt: string;
}

export interface SystemAdminQueueIssue {
  readonly direction: "inbox" | "outbox";
  readonly recordId: string;
  readonly state: string;
  readonly route: string;
  readonly attempt: number;
  readonly safeErrorCode: string | null;
  readonly updatedAt: string;
}

export interface SystemAdminWorldCommands {
  pause(input: {
    readonly tenantId: TenantId;
    readonly worldId: string;
    readonly expectedRevision: number;
  }): Promise<SystemAdminWorld>;
  resume(input: {
    readonly tenantId: TenantId;
    readonly worldId: string;
    readonly expectedRevision: number;
  }): Promise<SystemAdminWorld>;
}

export interface SystemAdminService {
  snapshot(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<SystemAdminSnapshot>;
  listMemoryJobs(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly SystemAdminMemoryJob[]>;
  listQueueIssues(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly SystemAdminQueueIssue[]>;
  listWorlds(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly SystemAdminWorld[]>;
  pauseWorld(input: {
    readonly authorizationHeader: string | undefined;
    readonly worldId: string;
    readonly expectedRevision: number;
  }): Promise<SystemAdminWorld>;
  resumeWorld(input: {
    readonly authorizationHeader: string | undefined;
    readonly worldId: string;
    readonly expectedRevision: number;
  }): Promise<SystemAdminWorld>;
  listApprovals(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly SystemAdminApproval[]>;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function tenant(authority: { readonly tenantId: TenantId }): TenantId {
  return authority.tenantId;
}


export function createSystemAdminService(input: {
  readonly database: PlatformAdminQuery;
  readonly authorizer: AgentAdminAuthorizer;
  readonly worldCommands?: SystemAdminWorldCommands;
}): SystemAdminService {
  return Object.freeze<SystemAdminService>({
    async snapshot(request) {
      const memoryAuthority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "memory.admin.read",
      });
      const queueAuthority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "queues.admin.read",
      });
      if (queueAuthority.tenantId !== memoryAuthority.tenantId) {
        throw new Error("Operator capabilities resolved to different tenants");
      }

      const result = await input.database.query<{
        total_records: string | number;
        active_records: string | number;
        tombstoned_records: string | number;
        extraction_queued: string | number;
        extraction_processing: string | number;
        extraction_retry_scheduled: string | number;
        extraction_dead_letter: string | number;
        outbox_pending: string | number;
        outbox_retry_scheduled: string | number;
        outbox_dead_letter: string | number;
        inbox_admitted: string | number;
        inbox_processing: string | number;
        inbox_failed: string | number;
        inbox_dead_letter: string | number;
      }>(
        `SELECT
          (SELECT count(*) FROM memory.records WHERE tenant_id = $1) AS total_records,
          (SELECT count(*) FROM memory.records WHERE tenant_id = $1 AND lifecycle_state = 'active') AS active_records,
          (SELECT count(*) FROM memory.records WHERE tenant_id = $1 AND lifecycle_state = 'tombstoned') AS tombstoned_records,
          (SELECT count(*) FROM memory.extraction_jobs WHERE tenant_id = $1 AND state = 'queued') AS extraction_queued,
          (SELECT count(*) FROM memory.extraction_jobs WHERE tenant_id = $1 AND state = 'processing') AS extraction_processing,
          (SELECT count(*) FROM memory.extraction_jobs WHERE tenant_id = $1 AND state = 'retry-scheduled') AS extraction_retry_scheduled,
          (SELECT count(*) FROM memory.extraction_jobs WHERE tenant_id = $1 AND state = 'dead-letter') AS extraction_dead_letter,
          (SELECT count(*) FROM events.outbox WHERE tenant_id = $1 AND state = 'pending') AS outbox_pending,
          (SELECT count(*) FROM events.outbox WHERE tenant_id = $1 AND state = 'retry-scheduled') AS outbox_retry_scheduled,
          (SELECT count(*) FROM events.outbox WHERE tenant_id = $1 AND state = 'dead-letter') AS outbox_dead_letter,
          (SELECT count(*) FROM events.inbox WHERE tenant_id = $1 AND state = 'admitted') AS inbox_admitted,
          (SELECT count(*) FROM events.inbox WHERE tenant_id = $1 AND state = 'processing') AS inbox_processing,
          (SELECT count(*) FROM events.inbox WHERE tenant_id = $1 AND state = 'failed') AS inbox_failed,
          (SELECT count(*) FROM events.inbox WHERE tenant_id = $1 AND state = 'dead-letter') AS inbox_dead_letter`,
        [tenant(memoryAuthority)],
      );
      const row = result.rows[0]!;
      return {
        memory: {
          totalRecords: count(row.total_records),
          activeRecords: count(row.active_records),
          tombstonedRecords: count(row.tombstoned_records),
          extractionQueued: count(row.extraction_queued),
          extractionProcessing: count(row.extraction_processing),
          extractionRetryScheduled: count(row.extraction_retry_scheduled),
          extractionDeadLetter: count(row.extraction_dead_letter),
        },
        queues: {
          outboxPending: count(row.outbox_pending),
          outboxRetryScheduled: count(row.outbox_retry_scheduled),
          outboxDeadLetter: count(row.outbox_dead_letter),
          inboxAdmitted: count(row.inbox_admitted),
          inboxProcessing: count(row.inbox_processing),
          inboxFailed: count(row.inbox_failed),
          inboxDeadLetter: count(row.inbox_dead_letter),
        },
      };
    },

    async listMemoryJobs(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "memory.admin.read",
      });
      const result = await input.database.query<{
        memory_extraction_id: string;
        state: string;
        scope_kind: string;
        source_kind: string;
        extractor_key: string;
        attempt: number;
        max_attempts: number;
        safe_error_code: string | null;
        updated_at: Date | string;
      }>(
        `SELECT memory_extraction_id, state, scope_kind, source_kind,
                extractor_key, attempt, max_attempts, safe_error_code,
                updated_at
           FROM memory.extraction_jobs
          WHERE tenant_id = $1
            AND state IN ('processing','retry-scheduled','dead-letter')
          ORDER BY updated_at DESC
          LIMIT 100`,
        [tenant(authority)],
      );
      return result.rows.map((row) => ({
        memoryExtractionId: row.memory_extraction_id,
        state: row.state,
        scopeKind: row.scope_kind,
        sourceKind: row.source_kind,
        extractorKey: row.extractor_key,
        attempt: row.attempt,
        maxAttempts: row.max_attempts,
        safeErrorCode: row.safe_error_code,
        updatedAt: iso(row.updated_at),
      }));
    },

    async listQueueIssues(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "queues.admin.read",
      });
      const result = await input.database.query<{
        direction: "inbox" | "outbox";
        record_id: string;
        state: string;
        route: string;
        attempt: number;
        safe_error_code: string | null;
        updated_at: Date | string;
      }>(
        `SELECT 'outbox'::text AS direction,
                outbox_event_id AS record_id,
                state,
                destination AS route,
                attempt,
                safe_error_code,
                updated_at
           FROM events.outbox
          WHERE tenant_id = $1
            AND state IN ('retry-scheduled','unknown','dead-letter','claimed')
          UNION ALL
         SELECT 'inbox'::text AS direction,
                event_id AS record_id,
                state,
                namespace AS route,
                attempt,
                safe_error_code,
                updated_at
           FROM events.inbox
          WHERE tenant_id = $1
            AND state IN ('processing','failed','dead-letter')
          ORDER BY updated_at DESC
          LIMIT 100`,
        [tenant(authority)],
      );
      return result.rows.map((row) => ({
        direction: row.direction,
        recordId: row.record_id,
        state: row.state,
        route: row.route,
        attempt: row.attempt,
        safeErrorCode: row.safe_error_code,
        updatedAt: iso(row.updated_at),
      }));
    },

    async listWorlds(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "world.admin.read",
      });
      const result = await input.database.query<{
        world_id: string;
        status: SystemAdminWorld["status"];
        policy_revision: string | number;
        current_generation_number: string | number;
        simulation_time: Date | string;
        revision: string | number;
        updated_at: Date | string;
      }>(
        `SELECT world_id, status, policy_revision, current_generation_number,
                simulation_time, revision, updated_at
           FROM world.worlds
          WHERE tenant_id = $1
          ORDER BY updated_at DESC
          LIMIT 100`,
        [tenant(authority)],
      );
      return result.rows.map((row) => ({
        worldId: row.world_id,
        status: row.status,
        policyRevision: count(row.policy_revision),
        currentGenerationNumber: count(row.current_generation_number),
        simulationTime: iso(row.simulation_time),
        revision: count(row.revision),
        updatedAt: iso(row.updated_at),
      }));
    },

    async pauseWorld(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "world.admin.write",
      });
      if (!input.worldCommands) {
        throw new Error("World administration is unavailable");
      }
      return input.worldCommands.pause({
        tenantId: tenant(authority),
        worldId: request.worldId,
        expectedRevision: request.expectedRevision,
      });
    },

    async resumeWorld(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "world.admin.write",
      });
      if (!input.worldCommands) {
        throw new Error("World administration is unavailable");
      }
      return input.worldCommands.resume({
        tenantId: tenant(authority),
        worldId: request.worldId,
        expectedRevision: request.expectedRevision,
      });
    },

    async listApprovals(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "approvals.admin.read",
      });
      const result = await input.database.query<{
        approval_id: string;
        operation_id: string;
        kind: string;
        state: string;
        action: string;
        action_version: string;
        resource_key: string;
        risk_class: string;
        requested_at: Date | string;
        expires_at: Date | string;
        decided_at: Date | string | null;
        approver_key: string | null;
      }>(
        `SELECT approval_id, operation_id, kind, state, action, action_version,
                resource_key, risk_class, requested_at, expires_at,
                decided_at, approver_key
           FROM security.approvals
          WHERE tenant_id = $1
          ORDER BY requested_at DESC
          LIMIT 100`,
        [tenant(authority)],
      );
      return result.rows.map((row) => ({
        approvalId: row.approval_id,
        operationId: row.operation_id,
        kind: row.kind,
        state: row.state,
        action: row.action,
        actionVersion: row.action_version,
        resourceKey: row.resource_key,
        riskClass: row.risk_class,
        requestedAt: iso(row.requested_at),
        expiresAt: iso(row.expires_at),
        decidedAt: row.decided_at === null ? null : iso(row.decided_at),
        approverKey: row.approver_key,
      }));
    },
  });
}
