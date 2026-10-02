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

    async recordEffectReceipt(
      input: Parameters<ToolOperationStore["recordEffectReceipt"]>[0],
    ): Promise<void> {
      await withTransaction(pool, async (client) => {
        await recordExternalReceipt(client, {
          tenantId: input.tenantId,
          operationId: input.operationId,
          provider: input.provider,
          observationKey: input.observationKey,
          normalizedStatus: input.normalizedStatus,
          payloadHash: input.payloadHash ?? undefined,
          normalizedPayload: input.normalizedPayload,
          observedAt: input.observedAt,
          verificationMethod: "tool-adapter-normalized-result",
          providerVersion: input.providerVersion ?? undefined,
        });
      });
    },

    loadEffectReceipts(
      tenantId: TenantId,
      operationId: OperationId,
    ) {
      return withTransaction(pool, async (client) => {
        const receipts = await listExternalReceiptsForOperation(
          client,
          tenantId,
          operationId,
        );
        return Object.freeze(
          receipts.map((receipt) =>
            Object.freeze({
              normalizedStatus: receipt.normalizedStatus,
              normalizedPayload:
                receipt.normalizedPayload as import("@masanawa/security").CanonicalJson | null,
            }),
          ),
        );
      });
    },
  });
}
