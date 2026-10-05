import type {
  AgentAdminAuthorizer,
  AgentAdminCapability,
} from "./agent_admin.js";
import {
  evaluateAdminAgentDelegation,
  type AdminAgentDelegationConfig,
} from "./admin_delegation.js";
import type { PlatformAdminService } from "./platform_admin.js";

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

export type AdminAgentActionResult =
  | {
      readonly status: "completed";
      readonly action: AdminAgentActionKey;
      readonly data: unknown;
    }
  | {
      readonly status: "approval-required";
      readonly action: AdminAgentActionKey;
      readonly capability: AgentAdminCapability;
      readonly reason: string;
    };

export interface AdminAgentActionBroker {
  execute(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly action: AdminAgentActionKey;
    readonly arguments?: Readonly<Record<string, unknown>>;
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

export function createAdminAgentActionBroker(input: {
  readonly config: AdminAgentDelegationConfig;
  readonly authorizer: AgentAdminAuthorizer;
  readonly platformAdmin: PlatformAdminService;
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
      if (decision.requiresApproval) {
        if (!operator.operatorUserId) {
          throw forbidden(
            "A canonical operator PlatformSession is required for governed admin writes",
          );
        }
        return Object.freeze({
          status: "approval-required" as const,
          action: request.action,
          capability: definition.capability,
          reason: decision.reason,
        });
      }

      const args = request.arguments ?? {};
      const authorizationHeader = request.authorizationHeader;

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
