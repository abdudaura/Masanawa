import { describe, expect, it } from "vitest";
import { createIncomingServerAuthorizer } from "./server_authorizer.js";
describe("incoming server authority", () => {
  it("denies absent configuration and consumer credentials", async () => {
    for (const secret of [undefined, "", " "]) {
      await expect(
        createIncomingServerAuthorizer(secret).authorize({
          authorizationHeader: "Bearer customer",
          tenantId: "tenant-a",
          characterId: "character-a",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    }
    await expect(
      createIncomingServerAuthorizer("server-secret").authorize({
        authorizationHeader: "Bearer customer",
        tenantId: "tenant-a",
        characterId: "character-a",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("accepts only the configured exact server credential", async () => {
    const auth = createIncomingServerAuthorizer("server-secret");
    await expect(
      auth.authorize({
        authorizationHeader: "Bearer server-secret",
        tenantId: "tenant-a",
        characterId: "character-a",
      }),
    ).resolves.toBeUndefined();
    for (const header of [
      undefined,
      "server-secret",
      "Bearer server-secret ",
      "bearer server-secret",
    ])
      await expect(
        auth.authorize({
          authorizationHeader: header,
          tenantId: "tenant-a",
          characterId: "character-a",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
  });
});
