import type {
  TwinEconomyGuardDecision,
  TwinEconomyLimitPolicy,
  TwinEconomyOperationAttempt,
} from "@masanawa/security";
import { guardTwinEconomyOperation } from "@masanawa/security";

export interface TwinEconomyGuardPolicyPort {
  readPolicy(input: {
    readonly tenantId: string;
    readonly operation: TwinEconomyOperationAttempt["operation"];
  }): Promise<TwinEconomyLimitPolicy>;
}

export interface TwinEconomyGuardHistoryPort {
  counts(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly operation: TwinEconomyOperationAttempt["operation"];
  }): Promise<{
    readonly operationsLastHour: number;
    readonly operationsLastDay: number;
  }>;
}

export interface TwinEconomyGuardService {
  preflight(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly operation: TwinEconomyOperationAttempt["operation"];
    readonly amountCredits: number;
    readonly recipientUserId?: string | null;
    readonly attributedOwnerUserId?: string | null;
  }): Promise<TwinEconomyGuardDecision>;
}

export function createTwinEconomyGuardService(input: {
  readonly policies: TwinEconomyGuardPolicyPort;
  readonly history: TwinEconomyGuardHistoryPort;
}): TwinEconomyGuardService {
  return Object.freeze({
    async preflight(request) {
      const [policy, counts] = await Promise.all([
        input.policies.readPolicy({
          tenantId: request.tenantId,
          operation: request.operation,
        }),
        input.history.counts({
          tenantId: request.tenantId,
          actorUserId: request.actorUserId,
          operation: request.operation,
        }),
      ]);
      return guardTwinEconomyOperation({
        policy,
        attempt: {
          operation: request.operation,
          amountCredits: request.amountCredits,
          actor: {
            actorUserId: request.actorUserId,
            recipientUserId: request.recipientUserId ?? null,
            attributedOwnerUserId: request.attributedOwnerUserId ?? null,
          },
          operationsLastHour: counts.operationsLastHour,
          operationsLastDay: counts.operationsLastDay,
        },
      });
    },
  });
}
