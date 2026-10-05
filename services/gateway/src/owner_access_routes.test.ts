import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { OwnerAccessService } from "./owner_access.js";
import { registerOwnerAccessRoutes } from "./owner_access_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("owner access routes", () => {
  it("returns a quote without creating a request", async () => {
    let quoted = false;
    const service: OwnerAccessService = {
      async quote(input) {
        quoted = true;
        return {
          requestId: "owner-request-123",
          ownerUserId: "user-owner",
          originatingCharacterId: input.characterId,
          modality: input.modality,
          durationMinutes: input.durationMinutes,
          priceCredits: 0,
          platformFeeCredits: 0,
          ownerEarningCredits: 0,
          chargeMode: "trial",
          trialDurationDays: 7,
          policyRevision: 1,
          trialPolicyRevision: 1,
          quoteExpiresAt: "2026-10-05T11:00:00Z",
        };
      },
      async request() {
        throw new Error("not used");
      },
      async act() {
        throw new Error("not used");
      },
      async read() {
        return null;
      },
    };
    const app = Fastify();
    apps.push(app);
    registerOwnerAccessRoutes(app, service);

    const response = await app.inject({
      method: "POST",
      url: "/agent/twin/owner-access/quote",
      payload: {
        characterId:
          "character_00000000-0000-4000-8000-000000000003",
        modality: "voice",
        durationMinutes: 20,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(quoted).toBe(true);
    expect(response.json().trialDurationDays).toBe(7);
  });
});
