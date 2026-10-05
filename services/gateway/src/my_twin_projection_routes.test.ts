import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { MyTwinProjectionService } from "./my_twin_projection.js";
import { registerMyTwinProjectionRoutes } from "./my_twin_projection_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("My Twin projection routes", () => {
  it("exposes one authenticated consumer endpoint", async () => {
    const service: MyTwinProjectionService = {
      async read() {
        return {
          hasTwin: true,
          characterId: "character-1",
          displayName: "Amina",
          bio: "",
          publicUrl: "https://masanawa.com/amina",
          discoverable: true,
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
      async setDiscoverable() {
        throw new Error("not used");
      },
    };
    const app = Fastify();
    apps.push(app);
    registerMyTwinProjectionRoutes(app, service);

    const response = await app.inject({
      method: "GET",
      url: "/v1/my-twin",
      headers: { authorization: "Bearer owner" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().publicUrl).toBe("https://masanawa.com/amina");
  });
});
