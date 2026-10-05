import type { AgentPresentationRepository } from "@masanawa/agents";
import { parseCanonicalId, type CharacterId, type TenantId } from "@masanawa/contracts";
import type {
  AgentAdminAuthorizer,
  AgentAdminCapability,
} from "./agent_admin.js";

export type AdminDelegateAutonomy =
  | "advisory"
  | "read-autonomous"
  | "confirm-writes";

export interface AdminAgentDelegate {
  readonly characterId: CharacterId;
  readonly label: string;
  readonly displayName: string | null;
  readonly roleLabel: string | null;
  readonly ready: boolean;
  readonly purpose: string;
  readonly autonomy: AdminDelegateAutonomy;
  readonly capabilities: readonly AgentAdminCapability[];
  readonly enabled: boolean;
  readonly approvalRequiredForWrites: boolean;
}

export interface AdminAgentDelegationConfig {
  readonly tenantId: TenantId;
  readonly delegates: readonly AdminAgentDelegate[];
}

export interface AdminAgentDelegationService {
  list(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly AdminAgentDelegate[]>;
}

const capabilitySet = new Set<AgentAdminCapability>([
  "agents.presentation.read",
  "agents.presentation.write",
  "agents.skills.read",
  "agents.skills.write",
  "skills.catalog.read",
  "skills.catalog.write",
  "platform.summary.read",
  "identity.users.read",
  "agents.runs.read",
  "commerce.read",
  "commerce.write",
  "operations.read",
  "reconciliation.read",
  "providers.credentials.read",
  "providers.credentials.write",
  "audit.read",
  "memory.admin.read",
  "world.admin.read",
  "world.admin.write",
  "approvals.admin.read",
  "queues.admin.read",
  "admin.delegates.read",
  "admin.delegates.write",
]);

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${name} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${name} is invalid`);
  return normalized;
}

function parseCapabilities(value: unknown): readonly AgentAdminCapability[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Admin delegate capabilities must be a non-empty array");
  }
  const output: AgentAdminCapability[] = [];
  for (const item of value) {
    if (item === "*") {
      for (const capability of capabilitySet) {
        if (!output.includes(capability)) output.push(capability);
      }
      continue;
    }
    if (typeof item !== "string" || !capabilitySet.has(item as AgentAdminCapability)) {
      throw new Error(`Unknown admin delegate capability: ${String(item)}`);
    }
    const capability = item as AgentAdminCapability;
    if (!output.includes(capability)) output.push(capability);
  }
  return Object.freeze(output.sort());
}


export type AdminDelegatedActionRisk =
  | "read-only"
  | "low"
  | "consequential"
  | "restricted";

export interface AdminDelegationDecision {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly reason: string;
}

export function evaluateAdminAgentDelegation(input: {
  readonly delegate: AdminAgentDelegate;
  readonly capability: AgentAdminCapability;
  readonly risk: AdminDelegatedActionRisk;
}): AdminDelegationDecision {
  if (!input.delegate.enabled) {
    return Object.freeze({
      allowed: false,
      requiresApproval: false,
      reason: "delegate-disabled",
    });
  }
  if (!input.delegate.capabilities.includes(input.capability)) {
    return Object.freeze({
      allowed: false,
      requiresApproval: false,
      reason: "capability-not-delegated",
    });
  }
  if (input.delegate.autonomy === "advisory") {
    return Object.freeze({
      allowed: false,
      requiresApproval: false,
      reason: "advisory-only",
    });
  }
  if (input.risk === "read-only") {
    return Object.freeze({
      allowed: true,
      requiresApproval: false,
      reason: "delegated-read",
    });
  }
  if (input.delegate.autonomy !== "confirm-writes") {
    return Object.freeze({
      allowed: false,
      requiresApproval: false,
      reason: "writes-not-delegated",
    });
  }
  return Object.freeze({
    allowed: true,
    requiresApproval: true,
    reason: input.risk === "low" ? "confirm-write" : "governed-write",
  });
}

export function readAdminAgentDelegationConfig(
  env: Readonly<Record<string, string | undefined>>,
): AdminAgentDelegationConfig | null {
  const raw = env.MASANAWA_OPS_AGENT_DELEGATES_JSON?.trim();
  const tenantRaw = env.MASANAWA_OPS_ADMIN_TENANT_ID?.trim()
    ?? env.MASANAWA_PLATFORM_TENANT_ID?.trim();
  if (!raw) return null;
  if (!tenantRaw) {
    throw new Error(
      "MASANAWA_OPS_AGENT_DELEGATES_JSON requires MASANAWA_PLATFORM_TENANT_ID or MASANAWA_OPS_ADMIN_TENANT_ID",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MASANAWA_OPS_AGENT_DELEGATES_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("MASANAWA_OPS_AGENT_DELEGATES_JSON must be a non-empty array");
  }

  const seen = new Set<string>();
  const delegates = parsed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid admin delegate");
    }
    const record = item as Record<string, unknown>;
    const characterId = parseCanonicalId("character", text(record.characterId, "characterId", 128));
    if (seen.has(characterId)) throw new Error("Duplicate admin delegate Character");
    seen.add(characterId);

    const autonomy = record.autonomy ?? "confirm-writes";
    if (
      autonomy !== "advisory" &&
      autonomy !== "read-autonomous" &&
      autonomy !== "confirm-writes"
    ) {
      throw new Error("Admin delegate autonomy is invalid");
    }

    return Object.freeze<AdminAgentDelegate>({
      characterId,
      label: text(record.label, "label", 120),
      displayName: null,
      roleLabel: null,
      ready: false,
      purpose: text(record.purpose ?? "Platform administration", "purpose", 500),
      autonomy,
      capabilities: parseCapabilities(record.capabilities),
      enabled: record.enabled !== false,
      approvalRequiredForWrites: true,
    });
  });

  return Object.freeze({
    tenantId: parseCanonicalId("tenant", tenantRaw),
    delegates: Object.freeze(delegates),
  });
}

export function createAdminAgentDelegationService(input: {
  readonly config: AdminAgentDelegationConfig;
  readonly authorizer: AgentAdminAuthorizer;
  readonly presentations: AgentPresentationRepository;
}): AdminAgentDelegationService {
  return Object.freeze({
    async list(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "admin.delegates.read",
      });
      if (authority.tenantId !== input.config.tenantId) {
        const error = new Error("Admin delegation tenant mismatch") as Error & {
          statusCode: number;
        };
        error.statusCode = 403;
        throw error;
      }
      const delegates = input.config.delegates.filter((delegate) => delegate.enabled);
      return Promise.all(delegates.map(async (delegate) => {
        const presentation = await input.presentations.readForCharacter({
          tenantId: authority.tenantId,
          characterId: delegate.characterId,
        });
        return Object.freeze({
          ...delegate,
          displayName: presentation?.displayName ?? null,
          roleLabel: presentation?.roleLabel ?? null,
          ready: presentation !== null,
        });
      }));
    },
  });
}
