import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseCanonicalId,
  type TenantId,
} from "@masanawa/contracts";
import type {
  AgentAdminAuthorizer,
  AgentAdminAuthority,
  AgentAdminCapability,
} from "./agent_admin.js";

export interface BootstrapAdminAuthConfig {
  readonly token: string;
  readonly tenantId: TenantId;
}

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
  readonly statusCode = 401;

  constructor() {
    super("Admin authorization denied");
    this.name = "AdminAuthorizationError";
  }
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
