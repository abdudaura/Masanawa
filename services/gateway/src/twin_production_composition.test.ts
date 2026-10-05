import { afterEach, describe, expect, it } from "vitest";
import { createGatewayApp } from "./app.js";
import {
  CustomerAuthError,
  type PlatformCustomerSessionAuthorizer,
} from "./customer_auth.js";
import { createTwinCustomerAuthorizers } from "./twin_customer_authorizers.js";
import type { MyTwinProjectionService } from "./my_twin_projection.js";
import type { TwinDirectoryService } from "./twin_directory.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Twin production composition", () => {
  it("adapts canonical customer sessions to Twin authorizers", async () => {
    const sessions: PlatformCustomerSessionAuthorizer = {
      async authorize(request) {
        if (request.authorizationHeader !== "Bearer customer") {
          throw new CustomerAuthError("UNAUTHORIZED", 401);
        }
        return {
          tenantId: "tenant_018f2f04-7f0d-7a65-8a2b-83cc6d7a0001" as never,
          userId: "user_018f2f04-7f0d-7a65-8a2b-83cc6d7a0002" as never,
          profile: {} as never,
        };
      },
    };
    const auth = createTwinCustomerAuthorizers({ sessions });

    await expect(
      auth.myTwin.authorize({
        authorizationHeader: "Bearer customer",
        capability: "my-twin.read",
      }),
    ).resolves.toMatchObject({
      tenantId: "tenant_018f2f04-7f0d-7a65-8a2b-83cc6d7a0001",
      userId: "user_018f2f04-7f0d-7a65-8a2b-83cc6d7a0002",
    });

    await expect(
      auth.directory.authorize({
        authorizationHeader: undefined,
        capability: "twin.directory.read",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("mounts My Twin and Explore through the canonical Gateway app", async () => {
    const myTwin: MyTwinProjectionService = {
      async read() {
        return {
          hasTwin: true,
          characterId: "character_018f2f04-7f0d-7a65-8a2b-83cc6d7a0003",
          displayName: "Amina",
          bio: "Technology and business",
          publicUrl: "https://masanawa.com/t/twin_am1na",
          discoverable: true,
          voiceEnabled: false,
          ownerAccessEnabled: false,
          languages: ["Hausa", "English"],
          summary: {
            visitors: 0,
            conversations: 0,
            earningsCredits: 0,
            pendingOwnerRequests: 0,
          },
        };
      },
      async setDiscoverable(request) {
        return {
          hasTwin: true,
          characterId: "character_018f2f04-7f0d-7a65-8a2b-83cc6d7a0003",
          displayName: "Amina",
          bio: "",
          publicUrl: "https://masanawa.com/t/twin_am1na",
          discoverable: request.discoverable,
          voiceEnabled: false,
          ownerAccessEnabled: false,
          languages: ["Hausa"],
          summary: {
            visitors: 0,
            conversations: 0,
            earningsCredits: 0,
            pendingOwnerRequests: 0,
          },
        };
      },
    };
    const twinDirectory: TwinDirectoryService = {
      async search() {
        return [
          {
            characterId: "character_018f2f04-7f0d-7a65-8a2b-83cc6d7a0003",
            publicId: "twin_am1na",
            displayName: "Amina",
            headline: "Technology and business",
            avatarUrl: null,
            representationLabel: "AI twin",
            ownerPresence: "not-present",
            textChatMode: "free",
          },
        ];
      },
      async resolve() {
        return null;
      },
    };

    const app = createGatewayApp({ myTwin, twinDirectory });
    apps.push(app);

    const profile = await app.inject({
      method: "GET",
      url: "/v1/my-twin",
      headers: { authorization: "Bearer customer" },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().displayName).toBe("Amina");

    const explore = await app.inject({
      method: "GET",
      url: "/agent/twins?q=amina",
      headers: { authorization: "Bearer customer" },
    });
    expect(explore.statusCode).toBe(200);
    expect(explore.json()).toHaveLength(1);
    expect(explore.json()[0].textChatMode).toBe("free");
  });

  it("maps customer-session failures to a safe HTTP response", async () => {
    const myTwin: MyTwinProjectionService = {
      async read() {
        throw new CustomerAuthError("UNAUTHORIZED", 401);
      },
      async setDiscoverable() {
        throw new CustomerAuthError("FORBIDDEN", 403);
      },
    };
    const app = createGatewayApp({ myTwin });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/my-twin",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});
