import { createHash } from "node:crypto";
import {
  PlatformError,
  createCanonicalId,
  toInstant,
  type CorrelationId,
  type EventId,
  type Instant,
  type OutboxEventId,
  type TenantId,
  type WorkflowRunId,
  type WorkflowVersionId,
} from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { enqueueOutbox } from "../events/outbox.js";
import { withTransaction } from "../transaction.js";

export type PersistedScheduleKind = "once" | "interval";

export interface WorkflowScheduleRecord {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly scheduleKey: string;
  readonly targetNodeKey: string;
  readonly kind: PersistedScheduleKind;
  readonly firstAt: Instant;
  readonly everyMs: number | null;
  readonly maxOccurrences: number | null;
  readonly endAt: Instant | null;
  readonly state: "active" | "completed";
  readonly nextSequence: number;
  readonly nextDueAt: Instant | null;
  readonly correlationId: CorrelationId;
  readonly destination: string;
  readonly definitionFingerprint: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CreateWorkflowScheduleInput {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly graphSignature: string;
  readonly scheduleKey: string;
  readonly targetNodeKey: string;
  readonly kind: PersistedScheduleKind;
  readonly firstAt: Instant;
  readonly everyMs: number | null;
  readonly maxOccurrences: number | null;
  readonly endAt: Instant | null;
  readonly correlationId: CorrelationId;
  readonly destination: string;
  readonly definitionFingerprint: string;
  readonly createdAt: Instant;
}

export interface MaterializedWorkflowOccurrence {
  readonly tenantId: TenantId;
  readonly workflowRunId: WorkflowRunId;
  readonly scheduleKey: string;
  readonly sequence: number;
  readonly dueAt: Instant;
  readonly targetNodeKey: string;
  readonly materializedAt: Instant;
  readonly outboxEventId: OutboxEventId;
}

interface ScheduleRow {
  tenant_id: TenantId;
  workflow_run_id: WorkflowRunId;
  workflow_version_id: WorkflowVersionId;
  graph_signature: string;
  schedule_key: string;
  target_node_key: string;
  kind: PersistedScheduleKind;
  first_at: Date;
  every_ms: string | null;
  max_occurrences: string | null;
  end_at: Date | null;
  state: "active" | "completed";
  next_sequence: string;
  next_due_at: Date | null;
  correlation_id: CorrelationId;
  destination: string;
  definition_fingerprint: string;
  created_at: Date;
  updated_at: Date;
}

function scheduleRecord(row: ScheduleRow): WorkflowScheduleRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowVersionId: row.workflow_version_id,
    graphSignature: row.graph_signature,
    scheduleKey: row.schedule_key,
    targetNodeKey: row.target_node_key,
    kind: row.kind,
    firstAt: toInstant(row.first_at),
    everyMs: row.every_ms === null ? null : Number(row.every_ms),
    maxOccurrences:
      row.max_occurrences === null ? null : Number(row.max_occurrences),
    endAt: row.end_at ? toInstant(row.end_at) : null,
    state: row.state,
    nextSequence: Number(row.next_sequence),
    nextDueAt: row.next_due_at ? toInstant(row.next_due_at) : null,
    correlationId: row.correlation_id,
    destination: row.destination,
    definitionFingerprint: row.definition_fingerprint,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

const scheduleColumns = `
  tenant_id, workflow_run_id, workflow_version_id, graph_signature,
  schedule_key, target_node_key, kind, first_at, every_ms, max_occurrences,
  end_at, state, next_sequence, next_due_at, correlation_id, destination,
  definition_fingerprint, created_at, updated_at
`;

function structuralFingerprint(input: CreateWorkflowScheduleInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        workflowRunId: input.workflowRunId,
        workflowVersionId: input.workflowVersionId,
        graphSignature: input.graphSignature,
        scheduleKey: input.scheduleKey,
        targetNodeKey: input.targetNodeKey,
        spec:
          input.kind === "once"
            ? {
                kind: "once",
                at: input.firstAt,
              }
            : {
                kind: "interval",
                firstAt: input.firstAt,
                everyMs: input.everyMs,
                maxOccurrences: input.maxOccurrences,
                endAt: input.endAt,
              },
        createdAt: input.createdAt,
      }),
      "utf8",
    )
    .digest("hex");
}

function assertDefinitionShape(input: CreateWorkflowScheduleInput): void {
  if (!input.destination.trim()) {
    throw new TypeError("schedule destination is required");
  }
  if (input.kind === "once") {
    if (
      input.everyMs !== null ||
      input.maxOccurrences !== null ||
      input.endAt !== null
    ) {
      throw new TypeError("one-shot schedule cannot carry interval bounds");
    }
  } else {
    if (
      input.everyMs === null ||
      !Number.isSafeInteger(input.everyMs) ||
      input.everyMs < 1
    ) {
      throw new TypeError("interval schedule requires positive everyMs");
    }
    if (
      input.maxOccurrences !== null &&
      (
        !Number.isSafeInteger(input.maxOccurrences) ||
        input.maxOccurrences < 1
      )
    ) {
      throw new TypeError("maxOccurrences must be null or a positive safe integer");
    }
    if (input.endAt !== null && input.endAt < input.firstAt) {
      throw new TypeError("endAt cannot precede firstAt");
    }
  }

  if (structuralFingerprint(input) !== input.definitionFingerprint) {
    throw new TypeError("schedule definition fingerprint does not match definition");
  }
}

export async function createWorkflowScheduleRecord(
  client: PoolClient,
  input: CreateWorkflowScheduleInput,
): Promise<WorkflowScheduleRecord> {
  assertDefinitionShape(input);

  const inserted = await client.query<ScheduleRow>(
    `INSERT INTO workflows.schedules (
       tenant_id, workflow_run_id, workflow_version_id, graph_signature,
       schedule_key, target_node_key, kind, first_at, every_ms,
       max_occurrences, end_at, state, next_sequence, next_due_at,
       correlation_id, destination, definition_fingerprint, created_at, updated_at
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',1,$8,$12,$13,$14,$15,$15
     )
     ON CONFLICT (tenant_id, workflow_run_id, schedule_key) DO NOTHING
     RETURNING ${scheduleColumns}`,
    [
      input.tenantId,
      input.workflowRunId,
      input.workflowVersionId,
      input.graphSignature,
      input.scheduleKey,
      input.targetNodeKey,
      input.kind,
      input.firstAt,
      input.everyMs,
      input.maxOccurrences,
      input.endAt,
      input.correlationId,
      input.destination,
      input.definitionFingerprint,
      input.createdAt,
    ],
  );
  if (inserted.rowCount === 1) {
    return scheduleRecord(inserted.rows[0]!);
  }

  const existing = await client.query<ScheduleRow>(
    `SELECT ${scheduleColumns}
       FROM workflows.schedules
      WHERE tenant_id = $1
        AND workflow_run_id = $2
        AND schedule_key = $3`,
    [input.tenantId, input.workflowRunId, input.scheduleKey],
  );
  const row = existing.rows[0];
  if (!row) {
    throw new Error("Schedule insert conflict could not be reconciled");
  }
  const current = scheduleRecord(row);
  if (
    current.definitionFingerprint !== input.definitionFingerprint ||
    current.workflowVersionId !== input.workflowVersionId ||
    current.graphSignature !== input.graphSignature ||
    current.correlationId !== input.correlationId ||
    current.destination !== input.destination
  ) {
    throw new PlatformError({
      code: "workflows.schedule_conflict",
      category: "conflict",
      message: "Schedule key is already bound to a different durable definition",
      retryable: false,
    });
  }
  return current;
}

function computeNext(
  row: ScheduleRow,
): Readonly<{
  state: "active" | "completed";
  nextSequence: number;
  nextDueAt: Instant | null;
}> {
  const nextSequence = Number(row.next_sequence) + 1;
  if (row.kind === "once") {
    return Object.freeze({
      state: "completed",
      nextSequence,
      nextDueAt: null,
    });
  }

  const everyMs = Number(row.every_ms);
  const maxOccurrences =
    row.max_occurrences === null ? null : Number(row.max_occurrences);
  if (maxOccurrences !== null && nextSequence > maxOccurrences) {
    return Object.freeze({
      state: "completed",
      nextSequence,
      nextDueAt: null,
    });
  }

  const dueMs =
    row.first_at.getTime() + (nextSequence - 1) * everyMs;
  if (!Number.isSafeInteger(dueMs)) {
    throw new PlatformError({
      code: "workflows.schedule_overflow",
      category: "validation",
      message: "Schedule occurrence exceeds safe time range",
      retryable: false,
    });
  }
  const nextDueAt = toInstant(new Date(dueMs));
  if (
    row.end_at !== null &&
    nextDueAt > toInstant(row.end_at)
  ) {
    return Object.freeze({
      state: "completed",
      nextSequence,
      nextDueAt: null,
    });
  }

  return Object.freeze({
    state: "active",
    nextSequence,
    nextDueAt,
  });
}

export async function materializeDueWorkflowOccurrences(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly limit: number;
  },
): Promise<readonly MaterializedWorkflowOccurrence[]> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("limit must be an integer between 1 and 100");
  }

  return withTransaction(pool, async (client) => {
    const due = await client.query<ScheduleRow>(
      `SELECT ${scheduleColumns}
         FROM workflows.schedules
        WHERE tenant_id = $1
          AND state = 'active'
          AND next_due_at <= clock_timestamp()
        ORDER BY next_due_at, workflow_run_id, schedule_key
        FOR UPDATE SKIP LOCKED
        LIMIT $2`,
      [input.tenantId, input.limit],
    );

    const materialized: MaterializedWorkflowOccurrence[] = [];
    for (const row of due.rows) {
      const sequence = Number(row.next_sequence);
      const dueAt = toInstant(row.next_due_at!);
      const now = await client.query<{ at: Date }>(
        "SELECT clock_timestamp() AS at",
      );
      const materializedAt = toInstant(now.rows[0]!.at);
      const eventId = createCanonicalId("event");
      const outboxEventId = await enqueueOutbox(client, {
        tenantId: row.tenant_id,
        eventId,
        eventType: "workflow.schedule.occurrence.v1",
        schemaVersion: 1,
        aggregateType: "workflow-schedule",
        aggregateId: `${row.workflow_run_id}:${row.schedule_key}`,
        correlationId: row.correlation_id,
        causationId: null,
        destination: row.destination,
        availableAt: materializedAt,
        payload: {
          workflowRunId: row.workflow_run_id,
          workflowVersionId: row.workflow_version_id,
          graphSignature: row.graph_signature,
          scheduleKey: row.schedule_key,
          sequence,
          dueAt,
          targetNodeKey: row.target_node_key,
        },
      });

      const occurrence = await client.query(
        `INSERT INTO workflows.schedule_occurrences (
           tenant_id, workflow_run_id, schedule_key, sequence, due_at,
           target_node_key, materialized_at, outbox_event_id
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          row.tenant_id,
          row.workflow_run_id,
          row.schedule_key,
          sequence,
          dueAt,
          row.target_node_key,
          materializedAt,
          outboxEventId,
        ],
      );
      if (occurrence.rowCount !== 1) {
        throw new Error("Workflow occurrence insert did not persist");
      }

      const next = computeNext(row);
      await client.query(
        `UPDATE workflows.schedules
            SET state = $4,
                next_sequence = $5,
                next_due_at = $6,
                updated_at = $7
          WHERE tenant_id = $1
            AND workflow_run_id = $2
            AND schedule_key = $3`,
        [
          row.tenant_id,
          row.workflow_run_id,
          row.schedule_key,
          next.state,
          next.nextSequence,
          next.nextDueAt,
          materializedAt,
        ],
      );

      materialized.push(
        Object.freeze({
          tenantId: row.tenant_id,
          workflowRunId: row.workflow_run_id,
          scheduleKey: row.schedule_key,
          sequence,
          dueAt,
          targetNodeKey: row.target_node_key,
          materializedAt,
          outboxEventId,
        }),
      );
    }

    return Object.freeze(materialized);
  });
}
