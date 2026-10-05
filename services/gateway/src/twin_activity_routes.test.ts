import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { TwinActivityService } from "./twin_activity.js";
import { registerTwinActivityRoutes } from "./twin_activity_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("twin activity routes", () => {
  it("forwards auth and returns the projection", async () => {
    let authorizationHeader: string | undefined;
    const service: TwinActivityService = {
      async read(input) {
        authorizationHeader = input.authorizationHeader;
        return {
          hasTwin: true,
          characterId: "character_1",
          summary: { visitors: 2, conversations: 1, earningsCredits: 20, pendingOwnerRequests: 0 },
          items: [],
        };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerTwinActivityRoutes(app, service);

    const response = await app.inject({
      method: "GET",
      url: "/agent/twin/activity?limit=20",
      headers: { authorization: "Bearer user" },
    });

    expect(response.statusCode).toBe(200);
    expect(authorizationHeader).toBe("Bearer user");
    expect(response.json().summary.visitors).toBe(2);
  });

  it("rejects unbounded limits", async () => {
    const service: TwinActivityService = {
      async read() {
        throw new Error("should not execute");
      },
    };
    const app = Fastify();
    apps.push(app);
    registerTwinActivityRoutes(app, service);
    const response = await app.inject({ method: "GET", url: "/agent/twin/activity?limit=1000" });
    expect(response.statusCode).toBe(500);
  });
});
