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
  readonly tenantId: TenantId;
  readonly userId: UserId | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly capabilities: ReadonlySet<AgentAdminCapability>;
}

export interface PlatformSessionAdminAuthConfig {
  readonly grants: readonly PlatformSessionAdminGrant[];
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
  "admin.delegates.read",
  "admin.delegates.write",
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

  const grants: PlatformSessionAdminGrant[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid Ops admin grant");
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.tenantId !== "string") {
      throw new Error("Each Ops admin grant requires tenantId");
    }
    const tenantId = parseCanonicalId("tenant", record.tenantId);
    const userId = typeof record.userId === "string"
      ? parseCanonicalId("user", record.userId)
      : null;
    const email = typeof record.email === "string"
      ? record.email.trim().toLowerCase()
      : null;
    const phone = typeof record.phone === "string"
      ? record.phone.trim().replace(/[\\s()-]/gu, "")
      : null;
    const selectors = [userId, email, phone].filter(Boolean);
    if (selectors.length !== 1) {
      throw new Error("Each Ops admin grant requires exactly one of userId, email or phone");
    }
    if (email && (email.length > 320 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/u.test(email))) {
      throw new Error("Ops admin grant email is invalid");
    }
    if (phone && !/^\\+[1-9]\\d{6,14}$/u.test(phone)) {
      throw new Error("Ops admin grant phone is invalid");
    }
    const selectorKey = userId ? `user:${userId}` : email ? `email:${email}` : `phone:${phone}`;
    const key = `${tenantId}:${selectorKey}`;
    if (seen.has(key)) throw new Error("Duplicate Ops admin grant");
    seen.add(key);
    grants.push(Object.freeze({
      tenantId,
      userId,
      email,
      phone,
      capabilities: parseCapabilities(record.capabilities),
    }));
  }
  return Object.freeze({ grants: Object.freeze(grants) });
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

      const grant = input.config.grants.find((candidate) =>
        candidate.tenantId === identity.tenantId &&
        (
          candidate.userId === identity.userId ||
          (candidate.email !== null &&
            candidate.email === identity.profile.email?.trim().toLowerCase()) ||
          (candidate.phone !== null &&
            candidate.phone === identity.profile.phone?.trim().replace(/[\\s()-]/gu, ""))
        ),
      );
      if (!grant || !grant.capabilities.has(request.capability)) {
        throw new AdminAuthorizationError(403);
      }
      return Object.freeze({
        tenantId: identity.tenantId,
        operatorUserId: identity.userId,
      });
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
      return Object.freeze({
        tenantId: config.tenantId,
        operatorUserId: null,
      });
    },
  });
}
