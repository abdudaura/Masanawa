import {
  PlatformError,
  type MemoryRecordId,
  type TenantId,
} from "@masanawa/contracts";
import type { PoolClient } from "pg";

export interface MemoryProjectionCleanupResult {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly lexicalDeleted: number;
  readonly vectorDeleted: number;
  readonly entityDeleted: number;
  readonly temporalDeleted: number;
}

function rowCount(value: number | null): number {
  return value ?? 0;
}

export async function cleanupTombstonedMemoryProjections(
  client: PoolClient,
  tenantId: TenantId,
  memoryRecordId: MemoryRecordId,
): Promise<MemoryProjectionCleanupResult> {
  const target = await client.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state
       FROM memory.records
      WHERE tenant_id = $1
        AND memory_record_id = $2
      FOR UPDATE`,
    [tenantId, memoryRecordId],
  );
  if (!target.rows[0]) {
    throw new PlatformError({
      code: "memory.projection_cleanup_record_not_found",
      category: "not-found",
      message: "MemoryRecord does not exist",
      retryable: false,
    });
  }
  if (target.rows[0].lifecycle_state !== "tombstoned") {
    throw new PlatformError({
      code: "memory.projection_cleanup_not_tombstoned",
      category: "conflict",
      message:
        "Projection cleanup is only allowed after canonical tombstone is committed",
      retryable: false,
    });
  }

  const lexical = await client.query(
    `DELETE FROM memory.lexical_projections
      WHERE tenant_id = $1
        AND memory_record_id = $2`,
    [tenantId, memoryRecordId],
  );
  const vector = await client.query(
    `DELETE FROM memory.vector_projections
      WHERE tenant_id = $1
        AND memory_record_id = $2`,
    [tenantId, memoryRecordId],
  );
  const entity = await client.query(
    `DELETE FROM memory.entity_projections
      WHERE tenant_id = $1
        AND memory_record_id = $2`,
    [tenantId, memoryRecordId],
  );
  const temporal = await client.query(
    `DELETE FROM memory.temporal_projections
      WHERE tenant_id = $1
        AND memory_record_id = $2`,
    [tenantId, memoryRecordId],
  );

  return Object.freeze({
    tenantId,
    memoryRecordId,
    lexicalDeleted: rowCount(lexical.rowCount),
    vectorDeleted: rowCount(vector.rowCount),
    entityDeleted: rowCount(entity.rowCount),
    temporalDeleted: rowCount(temporal.rowCount),
  });
}
