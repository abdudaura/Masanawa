import { describe, expect, it } from "vitest";
import {
  createBootstrapAdminAuthorizer,
  readBootstrapAdminAuthConfig,
} from "./admin_auth.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001";
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
