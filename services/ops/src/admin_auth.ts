import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseCanonicalId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  hashPlatformSessionToken,
  type PlatformSessionRepository,
} from "@masanawa/security";
import type {
  AgentAdminAuthorizer,
  AgentAdminAuthority,
  AgentAdminCapability,
} from "./agent_admin.js";

export interface BootstrapAdminAuthConfig {
  readonly token: string;
  readonly tenantId: TenantId;
}

export interface PlatformSessionAdminGrant {
  readonly userId: UserId;
  readonly capabilities: ReadonlySet<AgentAdminCapability>;
}

export interface PlatformSessionAdminAuthConfig {
  readonly grants: ReadonlyMap<UserId, ReadonlySet<AgentAdminCapability>>;
}

const KNOWN_ADMIN_CAPABILITIES = new Set<AgentAdminCapability>([
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
]);

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const digest = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(left), digest(right));
}

class AdminAuthorizationError extends Error {
  readonly statusCode: number;

  constructor(statusCode = 401) {
    super("Admin authorization denied");
    this.name = "AdminAuthorizationError";
    this.statusCode = statusCode;
  }
}

function parseCapabilities(value: unknown): ReadonlySet<AgentAdminCapability> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Each MASANAWA_OPS_ADMIN_GRANTS_JSON entry needs capabilities");
  }
  const capabilities = new Set<AgentAdminCapability>();
  for (const item of value) {
    if (item === "*") {
      for (const capability of KNOWN_ADMIN_CAPABILITIES) capabilities.add(capability);
      continue;
    }
    if (typeof item !== "string" ||
        !KNOWN_ADMIN_CAPABILITIES.has(item as AgentAdminCapability)) {
      throw new Error(`Unknown Ops admin capability: ${String(item)}`);
    }
    capabilities.add(item as AgentAdminCapability);
  }
  return capabilities;
}

export function readPlatformSessionAdminAuthConfig(
  env: Readonly<Record<string, string | undefined>>,
): PlatformSessionAdminAuthConfig | null {
  const raw = env.MASANAWA_OPS_ADMIN_GRANTS_JSON?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MASANAWA_OPS_ADMIN_GRANTS_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("MASANAWA_OPS_ADMIN_GRANTS_JSON must be a non-empty array");
  }

  const grants = new Map<UserId, ReadonlySet<AgentAdminCapability>>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid Ops admin grant");
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.userId !== "string") {
      throw new Error("Each Ops admin grant requires userId");
    }
    const userId = parseCanonicalId("user", record.userId);
    if (grants.has(userId)) throw new Error("Duplicate Ops admin user grant");
    grants.set(userId, parseCapabilities(record.capabilities));
  }
  return Object.freeze({ grants });
}

export function createPlatformSessionAdminAuthorizer(input: Readonly<{
  config: PlatformSessionAdminAuthConfig;
  sessions: PlatformSessionRepository;
  now?: () => string;
}>): AgentAdminAuthorizer {
  const now = input.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async authorize(request: {
      readonly authorizationHeader: string | undefined;
      readonly capability: AgentAdminCapability;
    }): Promise<AgentAdminAuthority> {
      const supplied = bearerToken(request.authorizationHeader);
      if (!supplied) throw new AdminAuthorizationError();
      let accessHash: string;
      try {
        accessHash = hashPlatformSessionToken(supplied);
      } catch {
        throw new AdminAuthorizationError();
      }
      const identity = await input.sessions.resolveAccess({
        accessHash,
        at: now(),
      });
      if (!identity) throw new AdminAuthorizationError();

      const capabilities = input.config.grants.get(identity.userId);
      if (!capabilities || !capabilities.has(request.capability)) {
        throw new AdminAuthorizationError(403);
      }
      return Object.freeze({ tenantId: identity.tenantId });
    },
  });
}

export function readBootstrapAdminAuthConfig(
  env: Readonly<Record<string, string | undefined>>,
): BootstrapAdminAuthConfig | null {
  const token = env.MASANAWA_OPS_ADMIN_TOKEN?.trim();
  const tenant = env.MASANAWA_OPS_ADMIN_TENANT_ID?.trim();

  if (!token && !tenant) return null;
  if (!token || !tenant) {
    throw new Error(
      "MASANAWA_OPS_ADMIN_TOKEN and MASANAWA_OPS_ADMIN_TENANT_ID must be configured together",
    );
  }
  if (token.length < 32) {
    throw new Error("MASANAWA_OPS_ADMIN_TOKEN must be at least 32 characters");
  }

  return Object.freeze({
    token,
    tenantId: parseCanonicalId("tenant", tenant),
  });
}

export function createBootstrapAdminAuthorizer(
  config: BootstrapAdminAuthConfig,
): AgentAdminAuthorizer {
  return Object.freeze({
    async authorize(input: {
      readonly authorizationHeader: string | undefined;
      readonly capability: AgentAdminCapability;
    }): Promise<AgentAdminAuthority> {
      const supplied = bearerToken(input.authorizationHeader);
      if (!supplied || !constantTimeEqual(supplied, config.token)) {
        throw new AdminAuthorizationError();
      }
      return Object.freeze({ tenantId: config.tenantId });
    },
  });
}
