import { describe, expect, it } from "vitest";
import { createPrincipalTalkSafetyPlatformAuthority } from "./platform_authority.js";

function sessions(input: Readonly<{
  userId?: string;
  email?: string | null;
  phone?: string | null;
}> = {}) {
  return {
    async authorize() {
      return {
        tenantId: "tenant_1" as never,
        userId: (input.userId ?? "user_1") as never,
        profile: {
          tenantId: "tenant_1" as never,
          userId: (input.userId ?? "user_1") as never,
          name: "User",
          email: input.email ?? null,
          phone: input.phone ?? null,
          locale: "en",
          createdAt: "2026-10-07T00:00:00.000Z",
        },
      };
    },
  };
}

describe("Talk safety platform authority", () => {
  it("requires configured admin principal membership in addition to a valid session", async () => {
    const authority = createPrincipalTalkSafetyPlatformAuthority({
      sessions: sessions({ userId: "ordinary_user" }),
      adminPrincipals: new Set(["admin_user"]),
    });

    await expect(
      authority.authorize({ authorizationHeader: "Bearer ordinary" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("authorizes a configured admin user id", async () => {
    const authority = createPrincipalTalkSafetyPlatformAuthority({
      sessions: sessions({ userId: "admin_user" }),
      adminPrincipals: new Set(["admin_user"]),
    });

    await expect(
      authority.authorize({ authorizationHeader: "Bearer admin" }),
    ).resolves.toEqual({
      tenantId: "tenant_1",
      actorId: "admin_user",
    });
  });

  it("matches configured admin email case-insensitively", async () => {
    const authority = createPrincipalTalkSafetyPlatformAuthority({
      sessions: sessions({ email: "ADMIN@EXAMPLE.COM" }),
      adminPrincipals: new Set(["admin@example.com"]),
    });

    await expect(
      authority.authorize({ authorizationHeader: "Bearer admin" }),
    ).resolves.toMatchObject({ actorId: "user_1" });
  });
});
