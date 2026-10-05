import { describe, expect, it } from "vitest";
import {
  createBootstrapAdminAuthorizer,
  createPlatformSessionAdminAuthorizer,
  readBootstrapAdminAuthConfig,
  readPlatformSessionAdminAuthConfig,
} from "./admin_auth.js";
import { hashPlatformSessionToken } from "@masanawa/security";

const tenantId = "tenant_0199cabc-1234-7abc-8def-1234567890ab";
const token = "0123456789abcdef0123456789abcdef";

describe("Ops bootstrap admin authorization", () => {
  it("requires token and tenant together", () => {
    expect(() =>
      readBootstrapAdminAuthConfig({
        MASANAWA_OPS_ADMIN_TOKEN: token,
      }),
    ).toThrow("must be configured together");
  });

  it("authorizes the exact bearer token for the configured tenant", async () => {
    const config = readBootstrapAdminAuthConfig({
      MASANAWA_OPS_ADMIN_TOKEN: token,
      MASANAWA_OPS_ADMIN_TENANT_ID: tenantId,
    });
    expect(config).not.toBeNull();

    const authorizer = createBootstrapAdminAuthorizer(config!);
    const authority = await authorizer.authorize({
      authorizationHeader: `Bearer ${token}`,
      capability: "platform.summary.read",
    });

    expect(authority.tenantId).toBe(tenantId);
  });

  it("rejects invalid credentials as HTTP 401-compatible errors", async () => {
    const config = readBootstrapAdminAuthConfig({
      MASANAWA_OPS_ADMIN_TOKEN: token,
      MASANAWA_OPS_ADMIN_TENANT_ID: tenantId,
    })!;
    const authorizer = createBootstrapAdminAuthorizer(config);

    await expect(
      authorizer.authorize({
        authorizationHeader: "Bearer wrong-token",
        capability: "identity.users.read",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("stays disabled when no bootstrap variables are configured", () => {
    expect(readBootstrapAdminAuthConfig({})).toBeNull();
  });
});


describe("Ops platform-session admin authorization", () => {
  const userId = "user_0199cabc-1234-7abc-8def-1234567890ab";
  const accessToken = "msw_access_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";

  it("parses explicit capability grants", () => {
    const config = readPlatformSessionAdminAuthConfig({
      MASANAWA_OPS_ADMIN_GRANTS_JSON: JSON.stringify([
        {
          userId,
          capabilities: ["platform.summary.read", "identity.users.read"],
        },
      ]),
    });
    expect(config?.grants.get(userId as never)?.has("identity.users.read")).toBe(true);
    expect(config?.grants.get(userId as never)?.has("commerce.write")).toBe(false);
  });

  it("supports full-admin wildcard grants without granting unlisted users", () => {
    const config = readPlatformSessionAdminAuthConfig({
      MASANAWA_OPS_ADMIN_GRANTS_JSON: JSON.stringify([
        { userId, capabilities: ["*"] },
      ]),
    })!;
    expect(config.grants.get(userId as never)?.has("commerce.write")).toBe(true);
    expect(config.grants.size).toBe(1);
  });

  it("authorizes a current canonical session only for granted capabilities", async () => {
    const config = readPlatformSessionAdminAuthConfig({
      MASANAWA_OPS_ADMIN_GRANTS_JSON: JSON.stringify([
        { userId, capabilities: ["platform.summary.read"] },
      ]),
    })!;
    const sessions = {
      resolveAccess: async ({ accessHash }: { accessHash: string; at: string }) =>
        accessHash === hashPlatformSessionToken(accessToken)
          ? {
              tenantId,
              userId,
              profile: {
                tenantId,
                userId,
                name: "Operator",
                email: "operator@example.com",
                phone: null,
                locale: "en-NG",
                createdAt: "2026-10-05T00:00:00.000Z",
              },
            }
          : null,
    } as never;
    const authorizer = createPlatformSessionAdminAuthorizer({
      config,
      sessions,
      now: () => "2026-10-05T03:00:00.000Z",
    });

    await expect(authorizer.authorize({
      authorizationHeader: `Bearer ${accessToken}`,
      capability: "platform.summary.read",
    })).resolves.toMatchObject({ tenantId });

    await expect(authorizer.authorize({
      authorizationHeader: `Bearer ${accessToken}`,
      capability: "commerce.write",
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a valid customer session that has no admin grant", async () => {
    const config = readPlatformSessionAdminAuthConfig({
      MASANAWA_OPS_ADMIN_GRANTS_JSON: JSON.stringify([
        { userId, capabilities: ["platform.summary.read"] },
      ]),
    })!;
    const sessions = {
      resolveAccess: async () => ({
        tenantId,
        userId: "user_0199cabc-1234-7abc-8def-1234567890ac",
        profile: {
          tenantId,
          userId: "user_0199cabc-1234-7abc-8def-1234567890ac",
          name: "Customer",
          email: "customer@example.com",
          phone: null,
          locale: "en-NG",
          createdAt: "2026-10-05T00:00:00.000Z",
        },
      }),
    } as never;
    const authorizer = createPlatformSessionAdminAuthorizer({ config, sessions });

    await expect(authorizer.authorize({
      authorizationHeader: `Bearer ${accessToken}`,
      capability: "platform.summary.read",
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
