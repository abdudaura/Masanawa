import type { OperationId } from "@masanawa/contracts";
import type { OperationRecord, OperationState } from "@masanawa/events";
import type {
  ToolOperationPrepareInput,
  ToolOperationStore,
} from "@masanawa/tools";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import {
  loadOperation,
  prepareOperation,
  transitionOperation,
} from "../events/operations.js";
import { beginReconciliation } from "../events/reconciliation.js";

export function createPostgresToolOperationStore(
  pool: Pool,
): ToolOperationStore {
  return Object.freeze({
    prepare(input: ToolOperationPrepareInput) {
      return withTransaction(pool, (client) =>
        prepareOperation(client, input),
      );
    },

    load(operationId: OperationId): Promise<OperationRecord | null> {
      return withTransaction(pool, async (client) => {
        const tenant = await client.query<{
          tenant_id: ToolOperationPrepareInput["tenantId"];
        }>(
          `SELECT tenant_id
             FROM events.operations
            WHERE operation_id = $1`,
          [operationId],
        );
        const row = tenant.rows[0];
        if (!row) {
          return null;
        }
        return loadOperation(client, row.tenant_id, operationId);
      });
    },

    transition(
      operationId: OperationId,
      from: OperationState,
      to: OperationState,
    ): Promise<OperationRecord> {
      return withTransaction(pool, (client) =>
        transitionOperation(client, {
          operationId,
          from,
          to,
        }),
      );
    },

    async beginReconciliation(input): Promise<void> {
      await beginReconciliation(pool, input);
    },
  });
}
