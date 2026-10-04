import { timingSafeEqual } from "node:crypto";
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
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
        throw new Error("Admin authorization denied");
      }
      return Object.freeze({ tenantId: config.tenantId });
    },
  });
}
