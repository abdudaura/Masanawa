import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { TwinSafetyService } from "./twin_safety.js";
import { registerTwinSafetyRoutes } from "./twin_safety_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("twin safety routes", () => {
  it("submits a report through the isolated route registrar", async () => {
    const service: TwinSafetyService = {
      async block() {
        return { blocked: true };
      },
      async unblock() {
        return { blocked: false };
      },
      async report(input) {
        expect(input.reason).toBe("impersonation");
        return { reportId: "report-1", status: "submitted" };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerTwinSafetyRoutes(app, service);
    const response = await app.inject({
      method: "POST",
      url: "/agent/twin/character-12345/report",
      payload: { reason: "impersonation", detail: "Looks fake" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("submitted");
  });
});
