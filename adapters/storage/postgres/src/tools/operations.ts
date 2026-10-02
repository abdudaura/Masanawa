import type { OperationId, TenantId } from "@masanawa/contracts";
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
import {
  beginReconciliation,
  listExternalReceiptsForOperation,
  recordExternalReceipt,
} from "../events/reconciliation.js";

export function createPostgresToolOperationStore(
  pool: Pool,
): ToolOperationStore {
  return Object.freeze({
    prepare(input: ToolOperationPrepareInput) {
      return withTransaction(pool, (client) =>
        prepareOperation(client, input),
      );
    },

    load(tenantId: TenantId, operationId: OperationId): Promise<OperationRecord | null> {
      return withTransaction(pool, (client) =>
        loadOperation(client, tenantId, operationId),
      );
    },

    transition(
      tenantId: TenantId,
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

    async beginReconciliation(input: Parameters<ToolOperationStore["beginReconciliation"]>[0]): Promise<void> {
      await beginReconciliation(pool, input);
    },

    recordReceipt(input: Parameters<ToolOperationStore["recordReceipt"]>[0]) {
      return withTransaction(pool, async (client) => {
        const recorded = await recordExternalReceipt(client, {
          tenantId: input.tenantId,
          operationId: input.operationId,
          provider: input.evidence.provider,
          observationKey: input.evidence.observationKey,
          ...(input.evidence.providerReference !== null
            ? { providerReference: input.evidence.providerReference }
            : {}),
          normalizedStatus: input.evidence.normalizedStatus,
          ...(input.evidence.payloadHash !== null
            ? { payloadHash: input.evidence.payloadHash }
            : {}),
          ...(input.evidence.payloadRef !== null
            ? { payloadRef: input.evidence.payloadRef }
            : {}),
          observedAt: input.evidence.observedAt,
          verificationMethod: input.evidence.verificationMethod,
          ...(input.evidence.providerVersion !== null
            ? { providerVersion: input.evidence.providerVersion }
            : {}),
        });
        return recorded.receipt;
      });
    },

    listReceipts(tenantId: TenantId, operationId: OperationId) {
      return withTransaction(pool, (client) =>
        listExternalReceiptsForOperation(client, tenantId, operationId),
      );
    },
  });
}
