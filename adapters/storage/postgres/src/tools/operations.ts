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

    load(tenantId, operationId: OperationId): Promise<OperationRecord | null> {
      return withTransaction(pool, (client) =>
        loadOperation(client, tenantId, operationId),
      );
    },

    transition(
      tenantId,
      operationId: OperationId,
      from: OperationState,
      to: OperationState,
    ): Promise<OperationRecord> {
      return withTransaction(pool, (client) =>
        transitionOperation(client, {
          operationId,
          tenantId,
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
