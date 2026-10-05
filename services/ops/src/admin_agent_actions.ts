import type {
  AgentAdminAuthorizer,
  AgentAdminCapability,
} from "./agent_admin.js";
import {
  evaluateAdminAgentDelegation,
  type AdminAgentDelegationConfig,
} from "./admin_delegation.js";
import type { PlatformAdminService } from "./platform_admin.js";
import type { SystemAdminService } from "./system_admin.js";

export type AdminAgentActionKey =
  | "platform.summary"
  | "users.list"
  | "agent-runs.list"
  | "offers.list"
  | "operations.list"
  | "reconciliation.list"
  | "audit.list"
  | "offer.set-enabled"
  | "credential.revoke"
  | "world.pause"
  | "world.resume";

export interface AdminAgentGovernedWriteInput {
  readonly tenantId: import("@masanawa/contracts").TenantId;
  readonly operatorUserId: import("@masanawa/contracts").UserId;
  readonly characterId: string;
  readonly agentRunId: string;
  readonly action: AdminAgentActionKey;
  readonly capability: AgentAdminCapability;
  readonly risk: "low" | "consequential" | "restricted";
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
}

export interface AdminAgentApprovalCommands {
  admit(input: AdminAgentGovernedWriteInput): Promise<{
    readonly approvalId: string;
    readonly operationId: string;
    readonly reused: boolean;
    readonly execution: "awaiting-approval" | "authorized" | "succeeded";
  }>;
  beginExecution(input: {
    readonly tenantId: import("@masanawa/contracts").TenantId;
    readonly operationId: string;
  }): Promise<void>;
  completeExecution(input: {
    readonly tenantId: import("@masanawa/contracts").TenantId;
    readonly operationId: string;
  }): Promise<void>;
  markExecutionUnknown(input: {
    readonly tenantId: import("@masanawa/contracts").TenantId;
    readonly operationId: string;
  }): Promise<void>;
}

export type AdminAgentActionResult =
  | {
      readonly status: "completed";
      readonly action: AdminAgentActionKey;
      readonly data: unknown;
      readonly operationId?: string;
      readonly replayed?: boolean;
    }
  | {
      readonly status: "approval-required";
      readonly action: AdminAgentActionKey;
      readonly capability: AgentAdminCapability;
      readonly reason: string;
      readonly approvalId: string;
      readonly operationId: string;
      readonly reused: boolean;
    };

export interface AdminAgentActionBroker {
  execute(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly action: AdminAgentActionKey;
    readonly arguments?: Readonly<Record<string, unknown>>;
    readonly agentRunId?: string;
    readonly idempotencyKey?: string;
  }): Promise<AdminAgentActionResult>;
}

const actions: Readonly<Record<
  AdminAgentActionKey,
  {
    readonly capability: AgentAdminCapability;
    readonly risk: "read-only" | "low" | "consequential" | "restricted";
  }
>> = Object.freeze({
  "platform.summary": {
    capability: "platform.summary.read",
    risk: "read-only",
  },
  "users.list": {
    capability: "identity.users.read",
    risk: "read-only",
  },
  "agent-runs.list": {
    capability: "agents.runs.read",
    risk: "read-only",
  },
  "offers.list": {
    capability: "commerce.read",
    risk: "read-only",
  },
  "operations.list": {
    capability: "operations.read",
    risk: "read-only",
  },
  "reconciliation.list": {
    capability: "reconciliation.read",
    risk: "read-only",
  },
  "audit.list": {
    capability: "audit.read",
    risk: "read-only",
  },
  "offer.set-enabled": {
    capability: "commerce.write",
    risk: "consequential",
  },
  "credential.revoke": {
    capability: "providers.credentials.write",
    risk: "restricted",
  },
  "world.pause": {
    capability: "world.admin.write",
    risk: "consequential",
  },
  "world.resume": {
    capability: "world.admin.write",
    risk: "consequential",
  },
});

function boundedLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new TypeError("Admin Agent action limit must be between 1 and 100");
  }
  return value as number;
}

function optionalString(
  value: unknown,
  name: string,
  allowed?: readonly string[],
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 128) {
    throw new TypeError(`${name} is invalid`);
  }
  if (allowed && !allowed.includes(value)) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
}

function forbidden(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 403;
  return error;
}

function requiredString(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return value.trim();
}

function requiredInteger(value: unknown, name: string, min = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) {
    throw new TypeError(`${name} is invalid`);
  }
  return value as number;
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} is invalid`);
  return value;
}

export function createAdminAgentActionBroker(input: {
  readonly config: AdminAgentDelegationConfig;
  readonly authorizer: AgentAdminAuthorizer;
  readonly platformAdmin: PlatformAdminService;
  readonly systemAdmin?: SystemAdminService;
  readonly approvalCommands?: AdminAgentApprovalCommands;
}): AdminAgentActionBroker {
  return Object.freeze({
    async execute(request) {
      const delegate = input.config.delegates.find(
        (candidate) =>
          candidate.enabled && candidate.characterId === request.characterId,
      );
      if (!delegate) throw forbidden("Character is not an enabled admin delegate");

      const definition = actions[request.action];
      const operator = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: definition.capability,
      });
      if (operator.tenantId !== input.config.tenantId) {
        throw forbidden("Operator and admin delegate tenant mismatch");
      }
      const decision = evaluateAdminAgentDelegation({
        delegate,
        capability: definition.capability,
        risk: definition.risk,
      });
      if (!decision.allowed) {
        throw forbidden(`Delegated admin action denied: ${decision.reason}`);
      }
      const args = request.arguments ?? {};
      const authorizationHeader = request.authorizationHeader;
      if (decision.requiresApproval) {
        if (!operator.operatorUserId) {
          throw forbidden(
            "A canonical operator PlatformSession is required for governed admin writes",
          );
        }
        if (!input.approvalCommands) {
          throw forbidden("Governed admin write approvals are not configured");
        }
        const agentRunId = optionalString(request.agentRunId, "agentRunId");
        const idempotencyKey = optionalString(
          request.idempotencyKey,
          "idempotencyKey",
        );
        if (!agentRunId || !idempotencyKey) {
          throw new TypeError(
            "Governed admin writes require agentRunId and idempotencyKey",
          );
        }

        const admitted = await input.approvalCommands.admit({
          tenantId: operator.tenantId,
          operatorUserId: operator.operatorUserId,
          characterId: request.characterId,
          agentRunId,
          action: request.action,
          capability: definition.capability,
          risk: definition.risk === "read-only" ? "low" : definition.risk,
          arguments: args,
          idempotencyKey,
        });

        if (admitted.execution === "awaiting-approval") {
          return Object.freeze({
            status: "approval-required" as const,
            action: request.action,
            capability: definition.capability,
            reason: decision.reason,
            approvalId: admitted.approvalId,
            operationId: admitted.operationId,
            reused: admitted.reused,
          });
        }

        if (admitted.execution === "succeeded") {
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            operationId: admitted.operationId,
            replayed: true,
            data: Object.freeze({
              operationId: admitted.operationId,
              replayed: true,
            }),
          });
        }

        await input.approvalCommands.beginExecution({
          tenantId: operator.tenantId,
          operationId: admitted.operationId,
        });

        try {
          let data: unknown;
          switch (request.action) {
            case "offer.set-enabled":
              data = await input.platformAdmin.setOfferEnabled({
                authorizationHeader,
                offerId: requiredString(args.offerId, "offerId"),
                expectedRevision: requiredInteger(
                  args.expectedRevision,
                  "expectedRevision",
                  1,
                ),
                enabled: requiredBoolean(args.enabled, "enabled"),
              });
              break;

            case "credential.revoke":
              data = await input.platformAdmin.revokeCredentialRef({
                authorizationHeader,
                credentialRefId: requiredString(
                  args.credentialRefId,
                  "credentialRefId",
                ),
                providerId: requiredString(args.providerId, "providerId"),
                slotKey: requiredString(args.slotKey, "slotKey"),
              });
              break;

            case "world.pause":
            case "world.resume": {
              if (!input.systemAdmin) {
                throw new Error("World administration is unavailable");
              }
              const worldInput = {
                authorizationHeader,
                worldId: requiredString(args.worldId, "worldId"),
                expectedRevision: requiredInteger(
                  args.expectedRevision,
                  "expectedRevision",
                  1,
                ),
              };
              data = request.action === "world.pause"
                ? await input.systemAdmin.pauseWorld(worldInput)
                : await input.systemAdmin.resumeWorld(worldInput);
              break;
            }

            case "platform.summary":
            case "users.list":
            case "agent-runs.list":
            case "offers.list":
            case "operations.list":
            case "reconciliation.list":
            case "audit.list":
              throw new Error("Read action unexpectedly entered governed write execution");
          }

          await input.approvalCommands.completeExecution({
            tenantId: operator.tenantId,
            operationId: admitted.operationId,
          });
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            operationId: admitted.operationId,
            replayed: false,
            data,
          });
        } catch (error) {
          await input.approvalCommands.markExecutionUnknown({
            tenantId: operator.tenantId,
            operationId: admitted.operationId,
          }).catch(() => undefined);
          throw error;
        }
      }

      switch (request.action) {
        case "platform.summary":
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.summary({ authorizationHeader }),
          });

        case "users.list": {
          const state = optionalString(args.state, "state", [
            "active",
            "disabled",
            "archived",
          ]) as "active" | "disabled" | "archived" | undefined;
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listUsers({
              authorizationHeader,
              limit: boundedLimit(args.limit),
              ...(state ? { state } : {}),
            }),
          });
        }

        case "agent-runs.list": {
          const state = optionalString(args.state, "state", [
            "running",
            "completed",
            "failed",
          ]) as "running" | "completed" | "failed" | undefined;
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listAgentRuns({
              authorizationHeader,
              limit: boundedLimit(args.limit),
              ...(state ? { state } : {}),
            }),
          });
        }

        case "offers.list":
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listOffers({
              authorizationHeader,
              limit: boundedLimit(args.limit),
            }),
          });

        case "operations.list":
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listOperations({
              authorizationHeader,
              limit: boundedLimit(args.limit),
              ...(optionalString(args.state, "state")
                ? { state: optionalString(args.state, "state")! }
                : {}),
            }),
          });

        case "reconciliation.list":
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listReconciliation({
              authorizationHeader,
              limit: boundedLimit(args.limit),
              ...(optionalString(args.status, "status")
                ? { status: optionalString(args.status, "status")! }
                : {}),
            }),
          });

        case "audit.list":
          return Object.freeze({
            status: "completed" as const,
            action: request.action,
            data: await input.platformAdmin.listAuditEvents({
              authorizationHeader,
              limit: boundedLimit(args.limit),
            }),
          });

        case "offer.set-enabled":
        case "credential.revoke":
        case "world.pause":
        case "world.resume":
          throw new Error("Unreachable write action without approval");
      }
    },
  });
}
